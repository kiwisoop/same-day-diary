"""Scene narration (local Supertonic voice F1). No paid API calls; the real model is not required."""
import json
import math
import struct
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import Mock, patch

import narration
import server
import test_app
import test_enhancements
import video_export as video


def write_tone(path, seconds, rate=44100):
    """A quiet 440 Hz tone standing in for a generated voice."""
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate)
        audio.writeframes(b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(int(seconds * rate))))


def fake_tts_dir(root):
    """Directory laid out like .tts/ so available() is true without the real model."""
    (root / 'venv' / 'bin').mkdir(parents=True)
    (root / 'venv' / 'bin' / 'python').write_text('')
    (root / 'models' / 'onnx').mkdir(parents=True)
    (root / 'models' / 'onnx' / 'vocoder.onnx').write_text('')
    (root / 'models' / 'voice_styles').mkdir(parents=True)
    (root / 'models' / 'voice_styles' / f'{narration.VOICE}.json').write_text('{}')
    return {'DIARY_TTS_DIR': str(root)}


class NarrationModuleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_voice_is_f1_and_cache_name_depends_on_text(self):
        self.assertEqual(narration.VOICE, 'F1')
        self.assertEqual(narration.cache_name('가'), narration.cache_name('가'))
        self.assertNotEqual(narration.cache_name('가'), narration.cache_name('나'))
        self.assertTrue(narration.cache_name('가').endswith('.wav'))

    def test_missing_model_is_reported_without_running_anything(self):
        environ = {'DIARY_TTS_DIR': str(self.root / 'none')}
        self.assertFalse(narration.available(environ))
        run = Mock()
        with self.assertRaisesRegex(ValueError, '설치'):
            narration.synthesize(['산책'], self.root / 'cache', environ, run)
        run.assert_not_called()

    def test_generates_only_missing_and_reuses_cache(self):
        environ = fake_tts_dir(self.root / 'tts')
        jobs = []

        def run(command, input, **kwargs):
            job = json.loads(input)
            jobs.append(job)
            self.assertEqual(command[1:], ['-I', str(narration.WORKER)])
            self.assertEqual(job['voice'], 'F1')
            for item in job['items']:
                write_tone(item['out'], 1.0)
            return subprocess.CompletedProcess(command, 0, '', '')

        first = narration.synthesize(['첫 장면', '둘째 장면'], self.root / 'cache', environ, run)
        self.assertTrue(all(path.is_file() for path in first))
        self.assertEqual(len(jobs[0]['items']), 2)
        again = narration.synthesize(['첫 장면', '셋째 장면'], self.root / 'cache', environ, run)
        self.assertEqual(again[0], first[0])
        self.assertEqual([item['text'] for item in jobs[1]['items']], ['셋째 장면'], '이미 만든 문장은 다시 만들지 않음')
        self.assertFalse(list((self.root / 'cache').glob('*.part.wav')))

    def test_failed_run_leaves_no_partial_files(self):
        environ = fake_tts_dir(self.root / 'tts')

        def run(command, input, **kwargs):
            for item in json.loads(input)['items']:
                Path(item['out']).write_bytes(b'half')
            return subprocess.CompletedProcess(command, 1, '', 'boom')

        with self.assertRaisesRegex(ValueError, '만들지 못했어요'):
            narration.synthesize(['장면'], self.root / 'cache', environ, run)
        self.assertEqual(list((self.root / 'cache').iterdir()), [])


class NarrationVideoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.image = str(Path(__file__).parent / 'assets/demo-walk.png')

    def tearDown(self):
        self.temp.cleanup()

    def test_scene_is_long_enough_for_the_voice(self):
        short, long = self.root / 'short.wav', self.root / 'long.wav'
        write_tone(short, 2.0); write_tone(long, 5.2)
        scene = {'date': '2024-11-17', 'caption': '산책', 'image_path': self.image}
        self.assertEqual(video.item_duration({**scene, 'narration': short}, True), 4)
        self.assertEqual(video.item_duration({**scene, 'narration': long}, True), 6.5)  # 0.3 + 5.2 + 0.6 → 6.5
        self.assertEqual(video.item_duration({**scene, 'narration': long}, False), 4, '긴 영상(쇼츠 아님)은 그대로')

    def test_filter_delays_each_voice_and_ducks_music(self):
        graph = video.narration_filter(12, [0, 4.5], 2)
        self.assertIn('[2:a]', graph); self.assertIn('[3:a]', graph)
        self.assertIn('adelay=delays=300:all=1', graph); self.assertIn('adelay=delays=4800:all=1', graph)
        self.assertIn('sidechaincompress', graph)
        self.assertTrue(graph.endswith('[a]'))
        self.assertIn('[music]', video.narration_filter(8, [0], 2))

    def test_missing_voice_file_rejected(self):
        scene = {'date': '2024-11-17', 'caption': '산책', 'image_path': self.image, 'narration': str(self.root / 'none.wav')}
        with self.assertRaisesRegex(ValueError, '내레이션'):
            video._validate_items([scene])

    @unittest.skipUnless(Path(video.FFMPEG).is_file(), 'ffmpeg 필요')
    def test_real_mp4_with_narration_has_length_audio_and_voice_credit(self):
        voice = self.root / 'voice.wav'
        write_tone(voice, 4.4)
        items = [{'date': '2024-11-17', 'caption': '리허설 첫 소절', 'image_path': self.image, 'narration': voice},
                 {'date': '2024-11-17', 'caption': '은행나무 길', 'image_path': self.image}]
        output = self.root / 'narrated.mp4'
        video.export_video(items, output, shorts=True)
        info = json.loads(subprocess.check_output([video.FFPROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(output)]))
        self.assertAlmostEqual(float(info['format']['duration']), 5.5 + 4, delta=0.1)
        self.assertIn('audio', [s['codec_type'] for s in info['streams']])
        comment = info['format'].get('tags', {}).get('comment', '')
        self.assertIn('Supertonic 3 F1', comment); self.assertIn('Jason Shaw', comment)


class NarrationServerTests(unittest.TestCase):
    setUp = test_app.DiaryTests.setUp
    request = test_app.DiaryTests.request

    def test_settings_report_availability_and_credit(self):
        with patch.object(server.narration, 'available', return_value=False):
            settings = self.request('GET', '/api/settings')[1]
        self.assertEqual(settings['narration'], {'available': False, 'credit': narration.CREDIT})

    def test_unavailable_or_invalid_narration_rejected_before_any_paid_call(self):
        with patch.object(server.narration, 'available', return_value=False), \
                patch.object(server.story_api, 'generate_story') as story, patch.object(server.image_api, 'generate_image') as image:
            self.assertEqual(self.request('POST', '/api/three-year-video', {'items': [], 'consent': True, 'narration': True})[0], 400)
            self.assertEqual(self.request('POST', '/api/three-year-video', {'items': [], 'consent': True, 'narration': 'yes'})[0], 400)
        story.assert_not_called(); image.assert_not_called()

    def test_day_shorts_attach_one_voice_per_scene_and_record_credit(self):
        entry = test_enhancements.EnhancementTests.entry_with_image(self)
        seen = {}

        def voices(texts, folder):
            seen['texts'] = texts
            return [Path(folder) / f'{index}.wav' for index, _ in enumerate(texts)]

        def encode(items, path, **kwargs):
            seen['items'] = items; path.write_bytes(b'video')

        with patch.object(server.narration, 'available', return_value=True), \
                patch.object(server.narration, 'synthesize', side_effect=voices), \
                patch.object(server, 'export_video', side_effect=encode), patch.object(server, 'item_duration', return_value=4):
            status, movie = self.request('POST', '/api/shorts', {'items': [entry], 'captions': ['아침 산책', '저녁 차'], 'narration': True})
        self.assertEqual(status, 200)
        self.assertEqual(seen['texts'], ['2024년 11월 17일. 아침 산책', '저녁 차'], '첫 장면 앞에 날짜를 읽음')
        self.assertEqual([item['narration'].name for item in seen['items']], ['0.wav', '1.wav'])
        self.assertEqual(movie['voice'], narration.CREDIT)

    def test_without_narration_nothing_is_synthesized(self):
        entry = test_enhancements.EnhancementTests.entry_with_image(self)
        with patch.object(server.narration, 'synthesize') as synth, \
                patch.object(server, 'export_video', side_effect=lambda items, path, **k: path.write_bytes(b'v')):
            status, movie = self.request('POST', '/api/shorts', {'items': [entry], 'captions': ['아침 산책']})
        self.assertEqual(status, 200)
        synth.assert_not_called()
        self.assertNotIn('voice', movie)


class SpokenLineTests(unittest.TestCase):
    """One set of lines: shown on screen and read aloud as-is; old edited spoken lines still work. No paid API calls."""
    setUp = test_app.DiaryTests.setUp
    request = test_app.DiaryTests.request

    def story_response(self, body):
        import io
        opener = Mock()
        opener.open.return_value = io.BytesIO(json.dumps({'choices': [{'message': {'content': json.dumps(body, ensure_ascii=False)}}]}).encode())
        with patch.object(server.story_api, 'get_api_key', return_value='fake-key'), patch.object(server.story_api, 'build_opener', return_value=opener):
            result = server.story_api.generate_story('2024-11-17', '가상 일기')
        return result, json.loads(opener.open.call_args.args[0].data)

    def test_prompt_asks_for_one_natural_spoken_line_per_scene(self):
        result, payload = self.story_response({'lines': ['박자를 놓쳐 버렸어', '친구랑 은행나무 길을 걸었지']})
        system = payload['messages'][0]['content']
        self.assertIn('"lines"', system); self.assertIn('그대로 목소리로 읽히는', system)
        self.assertIn('"~했구나", "~했네")는 쓰지 마세요', system, '~구나 말투 금지')
        self.assertIn('이웃한 두 문장의 어미가 같지 않게', system)
        self.assertNotIn('그날 나는,"처럼', system)
        self.assertEqual(result['captions'], ['박자를 놓쳐 버렸어', '친구랑 은행나무 길을 걸었지'])
        self.assertIsNone(result['narration'], '읽는 문장을 따로 두지 않고 자막을 그대로 읽음')
        legacy, _ = self.story_response({'captions': ['하나'], 'narration': ['다른 문장']})
        self.assertEqual((legacy['captions'], legacy['narration']), (['하나'], None))

    def test_validate_narration(self):
        self.assertEqual(server.story_api.validate_narration([' 그날  나는 '], 1), ['그날 나는'])
        for lines, count in ((['a'], 2), (['가' * 101], 1), ([''], 1), ([None], 1), ('문장', 1)):
            self.assertIsNone(server.story_api.validate_narration(lines, count))

    def test_voice_reads_spoken_line_with_date_before_each_diary(self):
        scenes = [{'date': '2024-11-17', 'caption': '자막1', 'spoken': '그날 나는, 놓쳤구나.'},
                  {'date': '2024-11-17', 'caption': '자막2'},
                  {'date': '2025-11-17', 'caption': '자막3', 'spoken': '실수했구나.'}]
        self.assertEqual(server.spoken_texts(scenes),
                         ['2024년 11월 17일. 그날 나는, 놓쳤구나.', '자막2', '2025년 11월 17일. 실수했구나.'])

    def test_demo_story_reads_its_captions_and_old_demo_story_is_upgraded(self):
        self.db.load_demo_data()
        entry = self.db.get_diary('2024-11-17')
        status, story = self.request('POST', '/api/shorts/story', {'date': entry['date'], 'content_hash': entry['content_hash'], 'consent': True})
        self.assertEqual(status, 200)
        self.assertIsNone(story['narration'], '자막을 그대로 읽음')
        self.assertTrue(all(not line.endswith(('다', '다.', '구나', '구나.')) for line in story['captions']), '~다·~구나로 끝나지 않음')
        self.assertTrue(all(len(line) <= 40 for line in story['captions']))
        key = 'shorts_story:2024-11-17'
        old = {**json.loads(self.db.get_setting(key)), 'version': 1, 'captions': ['박자를 놓쳤다'], 'narration': ['그날 나는, 놓쳤구나.']}
        self.db.set_setting(key, json.dumps(old, ensure_ascii=False))
        self.db.load_demo_data()
        upgraded = json.loads(self.db.get_setting(key))
        self.assertEqual((upgraded['version'], upgraded['captions'], upgraded['narration']), (2, story['captions'], None), '옛 시연 이야기는 새 문장으로 바뀜')
        edited = {**old, 'captions': ['내가 고친 자막'], 'edited': True}; edited.pop('demo')
        self.db.set_setting(key, json.dumps(edited, ensure_ascii=False))
        self.db.load_demo_data()
        self.assertEqual(json.loads(self.db.get_setting(key))['captions'], ['내가 고친 자막'], '사용자가 고친 이야기는 그대로')
        status, reopened = self.request('POST', '/api/shorts/story', {'date': entry['date'], 'content_hash': entry['content_hash'], 'consent': True})
        self.assertEqual(reopened['captions'], ['내가 고친 자막'], '예전 버전이어도 고친 이야기는 다시 씀')

    def test_shorts_use_edited_spoken_lines_and_remember_them(self):
        entry = test_enhancements.EnhancementTests.entry_with_image(self)
        self.db.set_setting('shorts_story:' + entry['date'], json.dumps(
            {'version': 1, 'content_hash': entry['content_hash'], 'captions': ['아침 산책', '저녁 차'], 'narration': None}, ensure_ascii=False))
        seen = {}

        def voices(texts, folder):
            seen['texts'] = texts
            return [Path(folder) / f'{index}.wav' for index, _ in enumerate(texts)]

        with patch.object(server.narration, 'available', return_value=True), patch.object(server.narration, 'synthesize', side_effect=voices), \
                patch.object(server, 'export_video', side_effect=lambda items, path, **k: path.write_bytes(b'v')), \
                patch.object(server, 'item_duration', return_value=4):
            body = {'items': [entry], 'captions': ['아침 산책', '저녁 차'], 'narration': True,
                    'spoken': ['그날 나는, 아침에 산책했구나.', '저녁엔 차를 마셨네.']}
            self.assertEqual(self.request('POST', '/api/shorts', body)[0], 200)
            self.assertEqual(self.request('POST', '/api/shorts', {**body, 'spoken': ['한 줄만']})[0], 400)
        self.assertEqual(seen['texts'], ['2024년 11월 17일. 그날 나는, 아침에 산책했구나.', '저녁엔 차를 마셨네.'])
        saved = json.loads(self.db.get_setting('shorts_story:' + entry['date']))
        self.assertEqual(saved['narration'], ['그날 나는, 아침에 산책했구나.', '저녁엔 차를 마셨네.'])
        status, story = self.request('POST', '/api/shorts/story', {'date': entry['date'], 'content_hash': entry['content_hash'], 'consent': True})
        self.assertEqual(story['narration'], saved['narration'], '다시 열면 고친 읽는 문장을 불러옴')


if __name__ == '__main__':
    unittest.main()
