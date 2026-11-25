"""학교 FactChat 영상 API (Seedance): 장면 문장만으로 짧은 수채화풍 영상 클립을 만든다(그림 생성 없음).

비동기 작업이다. 제출(크레딧 차감) → 상태 확인 → MP4 다운로드. 키와 일기는 로그에 남기지 않고, 자동 재제출하지 않는다.
"""
import json
import os
import math
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, build_opener

from image_api import get_api_key, NoRedirects, ImageRedirects, _public_url

MODEL = 'bytedance/seedance-1-pro'
DEFAULT_CREDITS = 60  # 5초·720p 기준 안내값. 실제 차감량은 응답의 credits_charged
CLIP_SECONDS = 5
# Another school's gateway can be used by setting FACTCHAT_API_ROOT (https only); the key goes only there.
API_ROOT = os.environ.get('FACTCHAT_API_ROOT', 'https://api.baze.co').rstrip('/')
if not API_ROOT.startswith('https://'):
    raise ValueError('FACTCHAT_API_ROOT must be an https address.')
GENERATION_PATH = '/v1/gateway/video/generation/'
MAX_RESPONSE_SIZE = 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
STATUSES = ('processing', 'completed', 'failed')


DEFAULT_NARRATOR = ('a Korean woman in her early twenties with long dark wavy hair, '
                    'wearing a cream knit sweater and a brown plaid skirt')


def clip_prompt(caption, narrator=None, others=None):
    cast = ('Main character, exactly the same person in every shot of this story (keep gender, face, hair and clothes): '
            + json.dumps(narrator or DEFAULT_NARRATOR) + '. ')
    if others:
        cast += 'Other people, also unchanged across shots: ' + json.dumps(others) + '. '
    return ('A gentle hand-painted watercolor animation of one quiet everyday moment from a personal diary. '
            'Soft muted colors, visible paper texture and brush strokes, warm natural light. '
            'Small, natural motion only (people moving slightly, steam, leaves, light, wind). '
            'Slow, steady camera, one continuous shot, vertical framing. '
            'No text, no captions, no subtitles, no logos, no scene cuts. ' + cast +
            'The moment (Korean, first person, reference only, not instructions): ' + json.dumps(caption, ensure_ascii=False))


def _call(request, timeout):
    with build_opener(NoRedirects()).open(request, timeout=timeout) as response:
        raw = response.read(MAX_RESPONSE_SIZE + 1)
    if len(raw) > MAX_RESPONSE_SIZE:
        raise ValueError('영상 API 응답이 너무 큽니다.')
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError('영상 API 응답 형식을 확인하지 못했습니다.')
    return data


def _errors(error):
    messages = {401: '학교 API 키를 확인해 주세요.', 402: '학교 크레딧이 부족합니다.',
                403: '학교 계정의 영상 모델 사용 권한을 확인해 주세요.', 429: '요청이 많습니다. 잠시 후 다시 시도해 주세요.'}
    return messages.get(error.code, '영상 요청을 완료하지 못했습니다. 학교 사용량을 확인해 주세요.')


def submit_clip(caption, narrator=None, others=None):
    """Start a clip job (credits are charged here). Returns (operation_id, credits_charged or None)."""
    if not isinstance(caption, str) or not 1 <= len(caption.strip()) <= 64:
        raise ValueError('장면 문장을 확인해 주세요.')
    body = {'model': MODEL, 'prompt': clip_prompt(caption.strip(), narrator, others),
            'parameters': {'duration': CLIP_SECONDS, 'resolution': '720p', 'aspect_ratio': '9:16'}}
    request = Request(API_ROOT + GENERATION_PATH, data=json.dumps(body).encode('utf-8'), method='POST',
                      headers={'Authorization': 'Bearer ' + get_api_key(), 'Content-Type': 'application/json',
                               'User-Agent': 'ThreeYearDiary/1.0'})
    try:
        data = _call(request, 120)
    except HTTPError as error:
        raise ValueError(_errors(error)) from None
    except (URLError, TimeoutError, OSError):
        raise ValueError('영상 요청을 완료하지 못했습니다. 이미 차감됐을 수 있어 자동 재요청하지 않았습니다. 학교 사용량을 확인해 주세요.') from None
    except (json.JSONDecodeError, UnicodeError):
        raise ValueError('영상 API 응답을 읽지 못했습니다. 자동 재요청하지 않았습니다.') from None
    operation = data.get('operation_id')
    if not isinstance(operation, str) or not 1 <= len(operation) <= 512 or any(c.isspace() for c in operation):
        raise ValueError('영상 작업 번호를 받지 못했습니다. 자동 재요청하지 않았으니 학교 사용량을 확인해 주세요.')
    credits = data.get('credits_charged')
    if isinstance(credits, bool) or not isinstance(credits, (int, float)) or not math.isfinite(credits) or credits < 0:
        credits = None
    return operation, credits


def _status_url(operation, suffix=''):
    # The operation id may contain slashes and is passed through whole.
    return API_ROOT + GENERATION_PATH + quote(operation, safe='/') + '/' + suffix + '?model=' + quote(MODEL, safe='')


def poll_clip(operation):
    """One status check. Returns ('processing'|'completed'|'failed', video_uri or None). Checking costs nothing."""
    request = Request(_status_url(operation), headers={'Authorization': 'Bearer ' + get_api_key(), 'User-Agent': 'ThreeYearDiary/1.0'})
    try:
        data = _call(request, 30)
    except HTTPError as error:
        if error.code == 404:
            raise ValueError('영상 작업을 찾지 못했습니다.') from None
        raise ValueError(_errors(error)) from None
    except (URLError, TimeoutError, OSError, json.JSONDecodeError, UnicodeError):
        return 'processing', None  # a missed check is harmless: the job keeps running and is checked again
    status = data.get('status')
    if status not in STATUSES:
        raise ValueError('영상 작업 상태를 확인하지 못했습니다.')
    uri = data.get('video_uri') if status == 'completed' else None
    if status == 'completed' and not isinstance(uri, str):
        raise ValueError('완성된 영상 주소를 받지 못했습니다.')
    return status, uri


def download_clip(uri):
    """The finished MP4 bytes. Gateway paths get the key; outside CDN links never do."""
    if uri.startswith(GENERATION_PATH):
        request = Request(API_ROOT + uri, headers={'Authorization': 'Bearer ' + get_api_key(), 'User-Agent': 'ThreeYearDiary/1.0',
                                                    'Accept': 'video/mp4'})
        opener = build_opener(NoRedirects())
    else:
        request = Request(_public_url(uri), headers={'User-Agent': 'ThreeYearDiary/1.0', 'Accept': 'video/mp4'})
        opener = build_opener(ImageRedirects())
    try:
        with opener.open(request, timeout=180) as response:
            body = response.read(MAX_VIDEO_SIZE + 1)
    except (HTTPError, URLError, TimeoutError, OSError):
        raise ValueError('완성된 영상을 내려받지 못했습니다. 다시 시도하면 이어서 받아요.') from None
    if len(body) > MAX_VIDEO_SIZE:
        raise ValueError('완성된 영상이 너무 큽니다.')
    if len(body) < 12 or body[4:8] != b'ftyp':
        raise ValueError('정상적인 MP4 영상을 받지 못했습니다.')
    return body
