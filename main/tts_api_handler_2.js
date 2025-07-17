//this uses the most up to date model from open ai as well as streaming method to make the audio play as it is generated ... this is more expensive but much better in terms of speed and responsiveness to instructions//
// It must be used in conjunction with lambda_function_2.js file in Lambda AWS//

class TTSAPIHandler {
    constructor() {
        this.lambdaEndpoint = ''; // To be set via setEndpoint
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.player = window.player;  // Use the global player instance
        this.currentSource = null;
    }

    setEndpoint(endpoint) {
        this.lambdaEndpoint = endpoint;
        console.log('TTS API endpoint set to:', endpoint);
    }

    async speak(ttsSettings) {
        if (!this.lambdaEndpoint) {
            console.error('Lambda endpoint not set');
            return;
        }

        // Check if speech is already playing
        if (this.player.GetVar("isSpeechPlaying") === "yes") {
            this.stop();
        }

        // Set speech playing state
        this.player.SetVar("isSpeechPlaying", "yes");

        try {
            // Process emphasis markup in the text
            const processedText = this.processEmphasisMarkup(ttsSettings.text);
            
            // Create instructions based on tone settings
            let instructions;
            if (ttsSettings.custom_instructions) {
                // Use custom structured instructions for mixed-tone text
                instructions = ttsSettings.custom_instructions;
            } else {
                // Use the standard instruction creation method
                instructions = this.createInstructions(ttsSettings.settings);
            }
            
            // Add context if available
            const fullInstructions = ttsSettings.context 
                ? `${ttsSettings.context}\n\n${instructions}`
                : instructions;

            // Log the full request details
            console.log('Starting TTS request with:', {
                text: processedText,
                voice: ttsSettings.voice_id,
                instructions: fullInstructions
            });

            const response = await fetch(this.lambdaEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: processedText,
                    voice: ttsSettings.voice_id,
                    instructions: fullInstructions
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the audio data as ArrayBuffer
            const audioData = await response.arrayBuffer();
            
            // Decode the audio data
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);
            
            // Create and play the audio
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            // Store the current source for potential stopping
            this.currentSource = source;
            
            // Play the audio
            source.start(0);
            
            // Return a promise that resolves when the audio finishes playing
            return new Promise((resolve) => {
                source.onended = () => {
                    this.currentSource = null;
                    this.player.SetVar("isSpeechPlaying", "no");
                    resolve();
                };
            });

        } catch (error) {
            console.error('Error in TTS request:', error);
            this.player.SetVar("isSpeechPlaying", "no");
            throw error;
        }
    }

    stop() {
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }
        this.player.SetVar("isSpeechPlaying", "no");
    }

    processEmphasisMarkup(text) {
        if (!text) return text;
        
        // Process asterisk emphasis: *text* -> <emphasis>text</emphasis>
        // This will be interpreted by the TTS system as emphasis
        let processedText = text.replace(/\*([^*]+)\*/g, '<emphasis>$1</emphasis>');
        
        // Log the transformation for debugging
        if (processedText !== text) {
            console.log('Emphasis markup processed:', {
                original: text,
                processed: processedText
            });
        }
        
        return processedText;
    }

    async playS3Audio(s3Url) {
        if (!s3Url) {
            console.error('No S3 URL provided');
            return Promise.resolve();
        }

        // Check if speech is already playing
        if (this.player.GetVar("isSpeechPlaying") === "yes") {
            this.stop();
        }

        // Set speech playing state
        this.player.SetVar("isSpeechPlaying", "yes");

        try {
            console.log('Playing S3 audio from:', s3Url);

            const response = await fetch(s3Url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the audio data as ArrayBuffer
            const audioData = await response.arrayBuffer();
            
            // Decode the audio data
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);
            
            // Create and play the audio
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            // Store the current source for potential stopping
            this.currentSource = source;
            
            // Play the audio
            source.start(0);
            
            // Return a promise that resolves when the audio finishes playing
            return new Promise((resolve) => {
                source.onended = () => {
                    this.currentSource = null;
                    this.player.SetVar("isSpeechPlaying", "no");
                    resolve();
                };
            });

        } catch (error) {
            console.error('Error playing S3 audio:', error);
            this.player.SetVar("isSpeechPlaying", "no");
            throw error;
        }
    }

    createInstructions(settings) {
        const instructions = [];
        
        // Add voice affect based on mannerisms (only for NPC requests)
        if (settings?.mannerisms) {
            const formality = settings.mannerisms.formality;
            const warmth = settings.mannerisms.warmth;
            const hesitation = settings.mannerisms.hesitation;
            
            // Create a rich description of the speaker's demeanor
            const formalityDesc = formality === '2' ? 'Professional and formal' : 
                                formality === '1' ? 'Balanced and neutral' : 
                                'Casual and approachable';
            
            const warmthDesc = warmth === '2' ? 'warm and friendly' : 
                             warmth === '1' ? 'moderately warm' : 
                             'neutral and composed';
            
            const hesitationDesc = hesitation === '2' ? 'with frequent thoughtful pauses' :
                                 hesitation === '1' ? 'with occasional pauses' :
                                 'with confident flow';
            
            instructions.push(`Voice Affect: ${formalityDesc}, ${warmthDesc}, ${hesitationDesc}.`);
        }
        
        // Add tone based on phonetic cues
        if (settings?.phonetic_cues) {
            const { intonation, rhythm, articulation, volume, pitch } = settings.phonetic_cues;
            
            // Create rich descriptions of speech characteristics
            const intonationDesc = intonation === '2' ? 'rising and questioning' :
                                 intonation === '1' ? 'natural and varied' :
                                 'falling and definitive';
            
            const rhythmDesc = rhythm === '4' ? 'bouncy and energetic' :
                             rhythm === '3' ? 'staccato and precise' :
                             rhythm === '2' ? 'relaxed and flowing' :
                             rhythm === '1' ? 'measured and deliberate' :
                             'flat and monotone';
            
            const articulationDesc = articulation === '2' ? 'sharp and clear' :
                                   articulation === '1' ? 'natural and relaxed' :
                                   'soft and gentle';
            
            const volumeDesc = volume === '3' ? 'overly loud' :
                             volume === '2' ? 'moderate and balanced' :
                             volume === '1' ? 'quiet and subdued' :
                             'whispered and intimate';

            const pitchDesc = pitch === '2' ? 'high and bright' :
                            pitch === '1' ? 'natural and balanced' :
                            'low and deep';
            
            instructions.push(`Tone: ${intonationDesc}, ${rhythmDesc}, ${articulationDesc}, ${volumeDesc}, ${pitchDesc}.`);
        }

        // Add pacing based on speaking rate
        if (settings?.speaking_rate) {
            const rate = settings.speaking_rate;
            const rateDesc = rate === '2' ? 'fast and urgent, as if time is running out' :
                           rate === '1' ? 'natural and balanced' :
                           'slow and deliberate, as if speaking to someone with limited language ability';
            instructions.push(`Pacing: ${rateDesc}.`);
        }
        
        // Add emphasis and pauses
        if (settings?.voice_settings) {
            const { emphasis, pauses } = settings.voice_settings;
            
            const emphasisDesc = emphasis === '2' ? 'strong and impactful' :
                               emphasis === '1' ? 'moderate and natural' :
                               'flat and even';
            
            const pausesDesc = pauses === '2' ? 'with extra pauses for clarity, as if speaking to someone with limited language ability' :
                             pauses === '1' ? 'with natural pauses' :
                             'with minimal pauses';
            
            instructions.push(`Delivery: ${emphasisDesc}, ${pausesDesc}.`);
        }
        
        return instructions.join('\n\n');
    }
}

// Create instance and assign to window
window.ttsAPIHandler = new TTSAPIHandler(); 