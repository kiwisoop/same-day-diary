"""AI scene clips (Seedance): one paid job per scene, resumed instead of resubmitted. No paid API calls."""
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import server
import test_app
import test_enhancements
import video_api
import video_export as video

MP4 = b'\x00\x00\x00\x18ftypisom' + b'\x00' * 32


def sample_clip(folder, seconds=2):
    path = Path(folder) / 'clip.mp4'
    subprocess.run([video.FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'testsrc=size=720x1280:rate=24:duration={seconds}',
                    '-pix_fmt', 'yuv420p', str(path)], check=True, capture_output=True, timeout=60)
    return path


class ClipServerTests(unittest.TestCase):
    setUp = test_app.DiaryTests.setUp
    request = test_app.DiaryTests.request
    entry_with_image = test_enhancements.EnhancementTests.entry_with_image

    def test_job_is_paid_once_resumed_and_reused(self):
        entry = self.entry_with_image()
        body = {**entry, 'caption': '친구랑 걸었어', 'consent': True}
        polls = iter([('processing', None), ('completed', '/v1/gateway/video/generation/op/1/download/?model=m')])
        with patch.object(server, 'CLIP_WAIT', 0), patch.object(server, 'CLIP_POLL', 0), \
                patch.object(server.video_api, 'submit_clip', return_value=('op/1', 60)) as submit, \
                patch.object(server.video_api, 'poll_clip', side_effect=lambda op: next(polls)) as poll, \
                patch.object(server.video_api, 'download_clip', return_value=MP4):
            self.assertEqual(self.request('POST', '/api/shorts/clip', {**body, 'consent': False})[0], 400, '동의 없이 제출하지 않음')
            status, first = self.request('POST', '/api/shorts/clip', body)
            self.assertEqual((status, first['status'], first['credits_charged']), (202, 'processing', 60))
            check = self.request('POST', '/api/shorts/clip', {**entry, 'caption': '친구랑 걸었어', 'check_only': True})[1]
            self.assertEqual(check, {'cached': False, 'processing': True})
            status, second = self.request('POST', '/api/shorts/clip', {**body, 'consent': False})
            self.assertEqual((status, second['status'], second['credits_charged']), (200, 'completed', 0), '진행 중 작업은 다시 제출하지 않고 이어서 확인')
            third = self.request('POST', '/api/shorts/clip', body)[1]
            self.assertEqual((third['cached'], third['credits_charged']), (True, 0))
        self.assertEqual(submit.call_count, 1)
        self.assertEqual([c.args[0] for c in poll.call_args_list], ['op/1', 'op/1'])
        clip = server.clip_file(self.db, self.db.get_diary(entry['date']), '친구랑 걸었어')
        self.assertEqual(clip.read_bytes(), MP4)
        self.db.delete_diary(entry['date'])
        self.assertIsNone(self.db.get_setting(server.clip_key(entry, '친구랑 걸었어', server.clip_cast(self.db, entry))), '일기를 지우면 영상 기록도 지움')

    def test_failed_job_is_cleared_without_needing_a_scene_picture(self):
        entry = self.entry_with_image()
        body = {**entry, 'caption': '차를 마셨어', 'consent': True}
        with patch.object(server, 'CLIP_POLL', 0), patch.object(server.video_api, 'submit_clip', return_value=('op2', 60)), \
                patch.object(server.video_api, 'poll_clip', return_value=('failed', None)):
            status, result = self.request('POST', '/api/shorts/clip', body)
        self.assertEqual(status, 400); self.assertIn('환불', result['error'])
        self.assertIsNone(server.clip_state(self.db, entry, '차를 마셨어'), '실패한 작업은 지워서 다시 시도 가능')

    def test_shorts_use_finished_clips(self):
        captions = ['아침 공부', '친구와 산책', '저녁 차']
        entry = self.entry_with_image()
        with patch.object(server.video_api, 'submit_clip', return_value=('op', 60)), \
                patch.object(server.video_api, 'poll_clip', return_value=('completed', 'https://cdn.example/x.mp4')), \
                patch.object(server.video_api, 'download_clip', return_value=MP4):
            self.request('POST', '/api/shorts/clip', {**entry, 'caption': '아침 공부', 'consent': True})
        seen = {}

        def encode(items, path, **kwargs):
            seen['clips'] = [bool(item.get('clip')) for item in items]
            seen['images'] = {item['image_path'].name for item in items}
            path.write_bytes(b'video')

        with patch.object(server, 'export_video', side_effect=encode):
            self.assertEqual(self.request('POST', '/api/shorts', {'items': [entry], 'captions': captions, 'clips': True})[0], 200)
        self.assertEqual(seen['clips'], [True, False, False], '영상이 있는 장면만 움직이고 나머지는 일기 그림')
        self.assertEqual(len(seen['images']), 1, '장면 그림 없이 일기 그림 한 장 사용')


class CastTests(unittest.TestCase):
    setUp = test_app.DiaryTests.setUp
    request = test_app.DiaryTests.request
    entry_with_image = test_enhancements.EnhancementTests.entry_with_image

    def test_every_clip_gets_the_same_people(self):
        entry = self.entry_with_image()
        story = {'captions': ['산책했어', '차를 마셨지'], 'narration': None, 'credits_charged': 1, 'model': 'm', 'shortened': False,
                 'narrator': 'a Korean man in his twenties with short hair', 'others': 'his friend: a woman with a bun'}
        with patch.object(server.story_api, 'generate_story', return_value=story):
            self.request('POST', '/api/shorts/story', {**entry, 'consent': True})
        self.assertEqual(self.db.get_setting(server.NARRATOR_KEY), story['narrator'], '처음 정한 주인공을 다음 일기에도 사용')
        sent = []
        with patch.object(server, 'CLIP_POLL', 0), patch.object(server.video_api, 'submit_clip', side_effect=lambda *a: sent.append(a) or ('op', 60)), \
                patch.object(server.video_api, 'poll_clip', return_value=('completed', 'https://cdn.example/x.mp4')), \
                patch.object(server.video_api, 'download_clip', return_value=MP4):
            for caption in story['captions']:
                self.request('POST', '/api/shorts/clip', {**entry, 'caption': caption, 'consent': True})
        self.assertEqual([a[1:] for a in sent], [(story['narrator'], story['others'])] * 2, '장면마다 같은 인물 설명')
        prompt = video_api.clip_prompt('산책했어', story['narrator'], story['others'])
        self.assertIn('same person in every shot', prompt); self.assertIn('short hair', prompt); self.assertIn('bun', prompt)
        self.assertIn('Korean woman', video_api.clip_prompt('산책했어'), '설명이 없어도 고정된 인물')

    def test_demo_years_share_one_diarist(self):
        self.db.load_demo_data()
        casts = {server.clip_cast(self.db, self.db.get_diary(d))[0] for d in ('2024-11-17', '2025-11-17', '2026-11-17')}
        self.assertEqual(len(casts), 1, '세 해 모두 같은 주인공')


class VideoApiTests(unittest.TestCase):
    def opener(self, payload):
        opener = Mock()
        opener.open.return_value = io.BytesIO(payload)
        return opener

    def test_submit_sends_text_only_seedance_vertical_clip(self):
        opener = self.opener(json.dumps({'operation_id': 'op/9', 'status': 'processing', 'credits_charged': 60}).encode())
        with patch.object(video_api, 'get_api_key', return_value='fake-key'), patch.object(video_api, 'build_opener', return_value=opener):
            operation, credits = video_api.submit_clip('유자차를 마셨어')
        request = opener.open.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual((operation, credits), ('op/9', 60))
        self.assertEqual(request.full_url, 'https://api.baze.co/v1/gateway/video/generation/')
        self.assertEqual(body['model'], 'bytedance/seedance-1-pro')
        self.assertEqual(body['parameters'], {'duration': 5, 'resolution': '720p', 'aspect_ratio': '9:16'})
        self.assertNotIn('input_urls', body, '그림 없이 문장만 보냄')
        self.assertIn('watercolor', body['prompt'])
        self.assertIn('유자차를 마셨어', body['prompt'])

    def test_poll_url_keeps_slashes_and_reads_status(self):
        opener = self.opener(json.dumps({'status': 'completed', 'video_uri': 'https://cdn.example/a.mp4'}).encode())
        with patch.object(video_api, 'get_api_key', return_value='fake-key'), patch.object(video_api, 'build_opener', return_value=opener):
            self.assertEqual(video_api.poll_clip('a/b'), ('completed', 'https://cdn.example/a.mp4'))
        self.assertEqual(opener.open.call_args.args[0].full_url,
                         'https://api.baze.co/v1/gateway/video/generation/a/b/?model=bytedance%2Fseedance-1-pro')
        bad = self.opener(json.dumps({'status': 'weird'}).encode())
        with patch.object(video_api, 'get_api_key', return_value='fake-key'), patch.object(video_api, 'build_opener', return_value=bad):
            with self.assertRaises(ValueError):
                video_api.poll_clip('a/b')

    def test_download_sends_key_only_to_gateway_and_checks_mp4(self):
        gateway = self.opener(MP4)
        with patch.object(video_api, 'get_api_key', return_value='fake-key'), patch.object(video_api, 'build_opener', return_value=gateway):
            self.assertEqual(video_api.download_clip('/v1/gateway/video/generation/op/download/?model=m'), MP4)
        self.assertEqual(gateway.open.call_args.args[0].get_header('Authorization'), 'Bearer fake-key')
        cdn = self.opener(MP4)
        with patch.object(video_api, '_public_url', side_effect=lambda u: u), patch.object(video_api, 'build_opener', return_value=cdn):
            video_api.download_clip('https://cdn.example/a.mp4')
            self.assertIsNone(cdn.open.call_args.args[0].get_header('Authorization'), '외부 주소에는 키를 보내지 않음')
            cdn.open.return_value = io.BytesIO(b'<html>not a video</html>')
            with self.assertRaises(ValueError):
                video_api.download_clip('https://cdn.example/a.mp4')


class ClipRenderTests(unittest.TestCase):
    def test_short_clip_holds_its_last_frame_for_the_whole_scene(self):
        with tempfile.TemporaryDirectory() as folder:
            clip = sample_clip(folder, seconds=2)
            out = Path(folder) / 'out.mp4'
            item = {'date': '2024-11-17', 'caption': '친구랑 걸었어', 'image_path': server.ROOT / 'assets/demo-walk.png', 'clip': clip}
            video.export_video([item], out, shorts=True)
            seconds = float(subprocess.run([video.FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)],
                                           capture_output=True, text=True, timeout=60).stdout)
            self.assertAlmostEqual(seconds, video.item_duration(item, True), delta=0.3, msg='클립이 짧아도 장면 길이만큼 이어짐')
            with self.assertRaises(ValueError):
                video.export_video([{**item, 'clip': Path(folder) / 'missing.mp4'}], Path(folder) / 'bad.mp4', shorts=True)


if __name__ == '__main__':
    unittest.main()
