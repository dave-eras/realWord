// this uses an earlier model of open ai - basic tts which didn't produce very different results based on the instructions and personlity types - it is however cheaper//
// to use this, you must also use the lambda_function.js file in the Lambda function on AWS//


class TTSAPIHandler {
    constructor() {
        this.lambdaEndpoint = ''; // To be set via setEndpoint
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.player = window.player;  // Use the global player instance
    }

    setEndpoint(endpoint) {
        this.lambdaEndpoint = endpoint;
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
            // Create instructions based on tone settings
            const instructions = this.createInstructions(ttsSettings.settings);
            
            // Add context if available
            const fullInstructions = ttsSettings.context 
                ? `${ttsSettings.context}\n\n${instructions}`
                : instructions;

            // Prepare the request body
            const requestBody = {
                text: ttsSettings.text,
                voice: ttsSettings.voice_id,
                instructions: fullInstructions
            };

            console.log('Sending request to Lambda:', requestBody);

            // Make the API request to Lambda
            const response = await fetch(this.lambdaEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the audio data
            const audioData = await response.arrayBuffer();
            
            // Play the audio
            await this.playAudio(audioData);

        } catch (error) {
            console.error('Error in TTS request:', error);
            this.player.SetVar("isSpeechPlaying", "no");
        }
    }

    createInstructions(settings) {
        const instructions = [];
        
        // Add voice affect based on mannerisms
        if (settings.mannerisms) {
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
        if (settings.phonetic_cues) {
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
        if (settings.speaking_rate) {
            const rate = settings.speaking_rate;
            const rateDesc = rate === '2' ? 'fast and urgent, as if time is running out' :
                           rate === '1' ? 'natural and balanced' :
                           'slow and deliberate, as if speaking to someone with limited language ability';
            instructions.push(`Pacing: ${rateDesc}.`);
        }

        // Add emphasis and pauses
        if (settings.voice_settings) {
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

    async playAudio(audioData) {
        try {
            // Decode the audio data
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);
            
            // Create a source node
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Connect to the audio context destination
            source.connect(this.audioContext.destination);
            
            // Play the audio
            source.start(0);
            
            // Return a promise that resolves when the audio finishes playing
            return new Promise((resolve) => {
                source.onended = () => {
                    this.player.SetVar("isSpeechPlaying", "no");
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            this.player.SetVar("isSpeechPlaying", "no");
        }
    }

    // Method to stop any currently playing audio
    stop() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.player.SetVar("isSpeechPlaying", "no");
        }
    }
}

// Create and export the handler instance
window.ttsAPIHandler = new TTSAPIHandler(); 