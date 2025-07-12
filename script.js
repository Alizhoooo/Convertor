document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const videoDropArea = document.getElementById('video-drop-area');
    const videoFileInput = document.getElementById('video-file');
    const videoInfo = document.getElementById('video-info');
    
    const subtitleDropArea = document.getElementById('subtitle-drop-area');
    const subtitleFileInput = document.getElementById('subtitle-file');
    const subtitleInfo = document.getElementById('subtitle-info');
    
    const convertBtn = document.getElementById('convert-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const resultContainer = document.getElementById('result-container');
    const resultVideo = document.getElementById('result-video');
    const downloadLink = document.getElementById('download-link');
    
    // Опции
    const subtitlePosition = document.getElementById('subtitle-position');
    const fontSize = document.getElementById('font-size');
    const fontColor = document.getElementById('font-color');
    
    // Переменные для хранения файлов
    let videoFile = null;
    let subtitleFile = null;
    
    // Функции для обработки drag and drop
    function setupDropArea(dropArea, fileInput, infoElement, fileType) {
        // Предотвращаем стандартное поведение браузера при перетаскивании
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Добавляем визуальный эффект при перетаскивании
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('active');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('active');
            }, false);
        });
        
        // Обработка события drop
        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            handleFile(file, fileType);
        }, false);
        
        // Обработка выбора файла через input
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0], fileType);
            }
        });
        
        // Клик по drop area открывает диалог выбора файла
        dropArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Обработка выбранного файла
        function handleFile(file, type) {
            if (type === 'video') {
                // Проверяем, что файл - видео
                if (!file.type.startsWith('video/')) {
                    showNotification('Пожалуйста, выберите видео файл', 'error');
                    return;
                }
                videoFile = file;
                displayFileInfo(file, videoInfo);
            } else if (type === 'subtitle') {
                // Проверяем расширение файла субтитров
                const validExtensions = ['.srt', '.vtt', '.ass'];
                const fileExt = '.' + file.name.split('.').pop().toLowerCase();
                if (!validExtensions.includes(fileExt)) {
                    showNotification('Пожалуйста, выберите файл субтитров (.srt, .vtt, .ass)', 'error');
                    return;
                }
                subtitleFile = file;
                displayFileInfo(file, subtitleInfo);
            }
            
            // Активируем кнопку конвертации, если оба файла выбраны
            checkFilesAndEnableButton();
        }
    }
    
    // Отображение информации о файле
    function displayFileInfo(file, infoElement) {
        const fileSize = formatFileSize(file.size);
        infoElement.innerHTML = `
            <p><strong>Имя:</strong> ${file.name}</p>
            <p><strong>Размер:</strong> ${fileSize}</p>
            <p><strong>Тип:</strong> ${file.type || 'Неизвестно'}</p>
        `;
    }
    
    // Форматирование размера файла
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Байт';
        const k = 1024;
        const sizes = ['Байт', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Проверка наличия обоих файлов и активация кнопки
    function checkFilesAndEnableButton() {
        if (videoFile && subtitleFile) {
            convertBtn.disabled = false;
        } else {
            convertBtn.disabled = true;
        }
    }
    
    // Инициализация областей для перетаскивания
    setupDropArea(videoDropArea, videoFileInput, videoInfo, 'video');
    setupDropArea(subtitleDropArea, subtitleFileInput, subtitleInfo, 'subtitle');
    
    // Обработка нажатия на кнопку конвертации
    convertBtn.addEventListener('click', () => {
        if (!videoFile || !subtitleFile) {
            showNotification('Пожалуйста, выберите видео и файл субтитров', 'error');
            return;
        }
        
        // Показываем прогресс
        progressContainer.style.display = 'block';
        resultContainer.style.display = 'none';
        
        // Создаем FormData для отправки файлов
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('subtitle', subtitleFile);
        formData.append('position', subtitlePosition.value);
        formData.append('font_size', fontSize.value);
        formData.append('font_color', fontColor.value.substring(1)); // Убираем # из цвета
        
        // Отправляем запрос на сервер
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/convert', true);
        
        // Обработка прогресса загрузки
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';
            }
        };
        
        // Обработка ответа сервера
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        // Показываем результат
                        showResult(response.video_url);
                        showNotification('Конвертация успешно завершена!', 'success');
                    } else {
                        showNotification('Ошибка: ' + response.error, 'error');
                        progressContainer.style.display = 'none';
                    }
                } catch (e) {
                    showNotification('Ошибка при обработке ответа сервера', 'error');
                    progressContainer.style.display = 'none';
                }
            } else {
                showNotification('Ошибка сервера: ' + xhr.status, 'error');
                progressContainer.style.display = 'none';
            }
        };
        
        // Обработка ошибок
        xhr.onerror = function() {
            showNotification('Ошибка соединения с сервером', 'error');
            progressContainer.style.display = 'none';
        };
        
        // Отправляем данные
        xhr.send(formData);
    });
    
    // Функция для отображения результата
    function showResult(videoUrl) {
        progressContainer.style.display = 'none';
        resultContainer.style.display = 'block';
        
        // Устанавливаем видео
        resultVideo.src = videoUrl;
        resultVideo.load();
        
        // Устанавливаем ссылку для скачивания
        downloadLink.href = videoUrl;
        downloadLink.download = 'video_with_subtitles.mp4';
    }
    
    // Функция для отображения уведомлений
    function showNotification(message, type) {
        // Удаляем предыдущие уведомления
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });
        
        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Добавляем уведомление на страницу
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
});