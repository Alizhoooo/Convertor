import os
import uuid
import subprocess
from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import secure_filename
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')

# Настройка директорий для загрузки и хранения файлов
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
OUTPUT_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'output')

# Создаем директории, если они не существуют
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Разрешенные расширения файлов
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
ALLOWED_SUBTITLE_EXTENSIONS = {'srt', 'vtt', 'ass'}

# Максимальный размер файла (500 МБ)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

# Проверка расширения файла
def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_video():
    try:
        # Проверяем наличие файлов в запросе
        if 'video' not in request.files or 'subtitle' not in request.files:
            return jsonify({'success': False, 'error': 'Видео или файл субтитров не найдены'})
        
        video_file = request.files['video']
        subtitle_file = request.files['subtitle']
        
        # Проверяем, что файлы выбраны
        if video_file.filename == '' or subtitle_file.filename == '':
            return jsonify({'success': False, 'error': 'Файлы не выбраны'})
        
        # Проверяем расширения файлов
        if not allowed_file(video_file.filename, ALLOWED_VIDEO_EXTENSIONS):
            return jsonify({'success': False, 'error': 'Неподдерживаемый формат видео'})
        
        if not allowed_file(subtitle_file.filename, ALLOWED_SUBTITLE_EXTENSIONS):
            return jsonify({'success': False, 'error': 'Неподдерживаемый формат субтитров'})
        
        # Генерируем уникальные имена файлов
        video_filename = secure_filename(str(uuid.uuid4()) + os.path.splitext(video_file.filename)[1])
        subtitle_filename = secure_filename(str(uuid.uuid4()) + os.path.splitext(subtitle_file.filename)[1])
        output_filename = secure_filename(str(uuid.uuid4()) + '.mp4')
        
        # Пути к файлам
        video_path = os.path.join(UPLOAD_FOLDER, video_filename)
        subtitle_path = os.path.join(UPLOAD_FOLDER, subtitle_filename)
        output_path = os.path.join(OUTPUT_FOLDER, output_filename)
        
        # Сохраняем загруженные файлы
        video_file.save(video_path)
        subtitle_file.save(subtitle_path)
        
        # Получаем параметры из запроса
        position = request.form.get('position', 'bottom')
        font_size = request.form.get('font_size', 'medium')
        font_color = request.form.get('font_color', 'FFFFFF')
        
        # Преобразуем параметры в значения для FFmpeg
        font_size_map = {
            'small': 16,
            'medium': 24,
            'large': 32
        }
        
        font_size_value = font_size_map.get(font_size, 24)
        
        # Определяем позицию субтитров
        if position == 'top':
            subtitle_position = '(w-text_w)/2:10'
        else:  # bottom
            subtitle_position = '(w-text_w)/2:h-text_h-10'
        
        # Команда FFmpeg для добавления субтитров
        ffmpeg_command = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f"subtitles={subtitle_path}:force_style='FontSize={font_size_value},PrimaryColour=&H{font_color},Alignment=2,Position={subtitle_position}'",
            '-c:a', 'copy',
            output_path
        ]
        
        logger.info(f"Executing FFmpeg command: {' '.join(ffmpeg_command)}")
        
        # Выполняем команду FFmpeg
        process = subprocess.Popen(ffmpeg_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            logger.error(f"FFmpeg error: {stderr.decode()}")
            return jsonify({'success': False, 'error': 'Ошибка при конвертации видео'})
        
        # Формируем URL для доступа к результату
        video_url = f"/static/output/{output_filename}"
        
        # Удаляем временные файлы
        try:
            os.remove(video_path)
            os.remove(subtitle_path)
        except Exception as e:
            logger.warning(f"Error removing temporary files: {e}")
        
        return jsonify({
            'success': True,
            'video_url': video_url
        })
        
    except Exception as e:
        logger.error(f"Error in convert_video: {e}")
        return jsonify({'success': False, 'error': str(e)})

# Маршрут для проверки статуса сервера
@app.route('/status')
def status():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)