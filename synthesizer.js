// ===== הסבר: הגדרת משתנים גלובליים =====
let audioContext;        // אודיו קונטקסט
let oscillator = null;   // אובייקט שיוצר את הגל הבסיסי
let gainNode = null;     // בקרת עוצמה
let filterNode = null;   // פילטר
let delayNode = null;    // אפקט הד
let analyser = null;     // אנלייזר לויזואלייזר
let activeNotes = {};    // מעקב אחר תווים פעילים
let isRecording = false; // האם מקליטים כרגע
let recordingStartTime = 0; // זמן תחילת ההקלטה
let recordedNotes = [];  // מערך התווים שהוקלטו
let recordings = [];     // מערך ההקלטות השמורות

// מיפוי מקשי המקלדת לתווים - אוקטבה ראשונה
const keyboardMapOctave1 = {
    'z': 'C3', 's': 'C#3', 'x': 'D3', 'd': 'D#3', 'c': 'E3', 'v': 'F3',
    'g': 'F#3', 'b': 'G3', 'h': 'G#3', 'n': 'A3', 'j': 'A#3', 'm': 'B3'
};

// מיפוי מקשי המקלדת לתווים - אוקטבה שנייה
const keyboardMapOctave2 = {
    'q': 'C4', '2': 'C#4', 'w': 'D4', '3': 'D#4', 'e': 'E4', 'r': 'F4',
    '5': 'F#4', 't': 'G4', '6': 'G#4', 'y': 'A4', '7': 'A#4', 'u': 'B4', 'i': 'C5'
};

// מיפוי תווים לתדרים
const noteFrequencies = {
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81,
    'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00,
    'A#3': 233.08, 'B3': 246.94, 'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 
    'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 
    'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88, 'C5': 523.25
};

// ===== הסבר: אתחול האפליקציה =====
function initApp() {
    // יצירת אודיו קונטקסט
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // הוספת מאזיני אירועים למקשי המקלדת
    document.querySelectorAll('.key').forEach(key => {
        // לחיצה על מקש עם העכבר
        key.addEventListener('mousedown', () => {
            const note = key.getAttribute('data-note');
            playNote(note);
        });
        
        // שחרור מקש העכבר
        key.addEventListener('mouseup', () => {
            const note = key.getAttribute('data-note');
            stopNote(note);
        });
        
        // יציאה מהמקש עם העכבר
        key.addEventListener('mouseleave', () => {
            const note = key.getAttribute('data-note');
            if (activeNotes[note]) {
                stopNote(note);
            }
        });
    });
    
    // מאזיני אירועים למקלדת המחשב
    document.addEventListener('keydown', (event) => {
        // בדיקה אם המקש נמצא במיפוי
        const key = event.key.toLowerCase();
        if (keyboardMapOctave1[key] && !event.repeat) {
            playNote(keyboardMapOctave1[key]);
        } else if (keyboardMapOctave2[key] && !event.repeat) {
            playNote(keyboardMapOctave2[key]);
        }
    });
    
    document.addEventListener('keyup', (event) => {
        // בדיקה אם המקש נמצא במיפוי
        const key = event.key.toLowerCase();
        if (keyboardMapOctave1[key]) {
            stopNote(keyboardMapOctave1[key]);
        } else if (keyboardMapOctave2[key]) {
            stopNote(keyboardMapOctave2[key]);
        }
    });
    
    // מאזיני אירועים לבקרות
    document.getElementById('waveform').addEventListener('change', () => {
        if (oscillator) {
            oscillator.type = document.getElementById('waveform').value;
        }
    });
    
    document.getElementById('filter').addEventListener('input', () => {
        if (filterNode) {
            filterNode.frequency.value = document.getElementById('filter').value;
        }
    });
    
    document.getElementById('resonance').addEventListener('input', () => {
        if (filterNode) {
            filterNode.Q.value = document.getElementById('resonance').value;
        }
    });
    
    document.getElementById('delay').addEventListener('input', () => {
        if (delayNode) {
            delayNode.delayTime.value = document.getElementById('delay').value;
        }
    });
    
    // מאזין אירועים לכפתור ההקלטה
    document.getElementById('record').addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
    
    // התחלת הויזואלייזר
    updateVisualizer();
    
    // הפעלת האודיו קונטקסט בלחיצה ראשונה (נדרש בדפדפנים חדשים)
    document.addEventListener('click', () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
}

// ===== הסבר: פונקציות עזר =====

// פונקציה ליצירת צליל
function createSound() {
    // יצירת אוסילטור (מחולל גלים)
    oscillator = audioContext.createOscillator();
    oscillator.type = document.getElementById('waveform').value;
    
    // יצירת בקרת עוצמה
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    
    // יצירת פילטר
    filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = document.getElementById('filter').value;
    filterNode.Q.value = document.getElementById('resonance').value;
    
    // יצירת אפקט הד
    delayNode = audioContext.createDelay();
    delayNode.delayTime.value = document.getElementById('delay').value;
    const delayFeedback = audioContext.createGain();
    delayFeedback.gain.value = 0.4;
    
    // יצירת אנלייזר לויזואלייזר
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // חיבור כל הרכיבים יחד
    oscillator.connect(gainNode);
    gainNode.connect(filterNode);
    filterNode.connect(analyser);
    filterNode.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // התחלת האוסילטור
    oscillator.start();
}

// פונקציה להפעלת תו
function playNote(note) {
    if (activeNotes[note]) return; // אם התו כבר פעיל, לא לעשות כלום
    
    // אם אין אוסילטור פעיל, ליצור אחד
    if (!oscillator) {
        createSound();
    }
    
    // עדכון תדר האוסילטור
    oscillator.frequency.setValueAtTime(noteFrequencies[note], audioContext.currentTime);
    
    // הפעלת מעטפת ADSR
    const attackTime = parseFloat(document.getElementById('attack').value);
    const decayTime = parseFloat(document.getElementById('decay').value);
    const sustainLevel = parseFloat(document.getElementById('sustain').value);
    
    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, audioContext.currentTime + attackTime + decayTime);
    
    // סימון התו כפעיל
    activeNotes[note] = {
        startTime: audioContext.currentTime,
        gainNode: gainNode
    };
    
    // הוספת התו להקלטה אם מקליטים
    if (isRecording) {
        recordedNotes.push({
            note: note,
            startTime: audioContext.currentTime - recordingStartTime,
            endTime: null // יעודכן בהמשך
        });
    }
    
    // עדכון המראה של המקש
    const keyElement = document.querySelector(`.key[data-note="${note}"]`);
    if (keyElement) {
        keyElement.classList.add('active');
    }
}

// פונקציה לעצירת תו
function stopNote(note) {
    if (!activeNotes[note]) return; // אם התו לא פעיל, לא לעשות כלום
    
    // הפעלת שלב השחרור במעטפת
    const releaseTime = parseFloat(document.getElementById('release').value);
    const currentGain = activeNotes[note].gainNode.gain.value;
    
    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.setValueAtTime(currentGain, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + releaseTime);
    
    // עדכון זמן הסיום בהקלטה
    if (isRecording) {
        const noteIndex = recordedNotes.findIndex(
            n => n.note === note && n.endTime === null
        );
        if (noteIndex !== -1) {
            recordedNotes[noteIndex].endTime = audioContext.currentTime - recordingStartTime;
        }
    }
    
    // הסרת סימון התו כפעיל
    setTimeout(() => {
        delete activeNotes[note];
        
        // אם אין תווים פעילים, לעצור את האוסילטור
        if (Object.keys(activeNotes).length === 0 && oscillator) {
            oscillator.stop();
            oscillator.disconnect();
            oscillator = null;
            gainNode = null;
            filterNode = null;
            delayNode = null;
        }
    }, releaseTime * 1000);
    
    // עדכון המראה של המקש
    const keyElement = document.querySelector(`.key[data-note="${note}"]`);
    if (keyElement) {
        keyElement.classList.remove('active');
    }
}

// פונקציה להתחלת הקלטה
function startRecording() {
    isRecording = true;
    recordingStartTime = audioContext.currentTime;
    recordedNotes = [];
    document.getElementById('record').textContent = 'עצור הקלטה';
    document.getElementById('record').classList.add('recording');
}

// פונקציה לעצירת הקלטה
function stopRecording() {
    isRecording = false;
    const recordingDuration = audioContext.currentTime - recordingStartTime;
    
    // שמירת ההקלטה
    recordings.push({
        notes: [...recordedNotes],
        duration: recordingDuration,
        name: `הקלטה ${recordings.length + 1}`
    });
    
    // עדכון רשימת ההקלטות
    updateRecordingsList();
    
    document.getElementById('record').textContent = 'הקלט';
    document.getElementById('record').classList.remove('recording');
}

// פונקציה לניגון הקלטה
function playRecording(index) {
    const recording = recordings[index];
    const startTime = audioContext.currentTime;
    
    // ניגון כל התווים בהקלטה
    recording.notes.forEach(note => {
        // הפעלת התו בזמן המתאים
        setTimeout(() => {
            playNote(note.note);
        }, note.startTime * 1000);
        
        // עצירת התו בזמן המתאים
        if (note.endTime !== null) {
            setTimeout(() => {
                stopNote(note.note);
            }, note.endTime * 1000);
        }
    });
}

// פונקציה לעדכון רשימת ההקלטות
function updateRecordingsList() {
    const recordingsList = document.getElementById('recordings-list');
    
    // ניקוי הרשימה
    while (recordingsList.children.length > 1) {
        recordingsList.removeChild(recordingsList.lastChild);
    }
    
    // הוספת כל ההקלטות לרשימה
    recordings.forEach((recording, index) => {
        const recordingItem = document.createElement('div');
        recordingItem.className = 'recording-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${recording.name} (${recording.duration.toFixed(2)} שניות)`;
        
        const playButton = document.createElement('button');
        playButton.textContent = 'נגן';
        playButton.addEventListener('click', () => playRecording(index));
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'מחק';
        deleteButton.addEventListener('click', () => {
            recordings.splice(index, 1);
            updateRecordingsList();
        });
        
        recordingItem.appendChild(nameSpan);
        recordingItem.appendChild(playButton);
        recordingItem.appendChild(deleteButton);
        
        recordingsList.appendChild(recordingItem);
    });
}

// פונקציה לעדכון הויזואלייזר
function updateVisualizer() {
    if (!analyser) return;
    
    const canvas = document.getElementById('visualizer-canvas');
    const canvasCtx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // התאמת גודל הקנבס לגודל האלמנט
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        requestAnimationFrame(draw);
        
        // קבלת נתוני התדר
        analyser.getByteFrequencyData(dataArray);
        
        // ניקוי הקנבס
        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // ציור הויזואלייזר
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 255 * canvas.height;
            
            // צביעת העמודות בצבעים שונים לפי התדר
            const hue = i / bufferLength * 360;
            canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
            if (x > canvas.width) break;
        }
    }
    
    draw();
}
