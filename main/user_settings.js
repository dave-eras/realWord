// User Settings Handler
class UserSettingsHandler {
    constructor() {
        this.userVoiceProfiles = {
            "male_1": {
                "voice_id": "echo",
                "description": "Frank has fabulous energy and a mischievous edge. He’s a charming, cheeky, sassy queen. His voice is playful, expressive, and very theatrical — think kitchen gossip with a raised eyebrow and a glass of wine in hand. He enunciates with flair, leans into sarcasm."
            },
            "male_2": {
                "voice_id": "fable",
                "description": "Bob's voice is deep, smooth but he is a young and innocent. He has a camp, dramatic streak like a WWE wrestler or Mike Tyson. He drags out vowels for emphasis (“toooonight”), and speaks like every word could explode."
            },
            "female_1": {
                "voice_id": "alloy",
                "description": "Victoire’s voice is slow, kind, bubbly, and a little breathy. She speaks with warmth and friendliness, in a soft, slightly nasal tone. She hesitates and is awkward."
            },
            "female_2": {
                "voice_id": "shimmer",
                "description": "Leen’s voice is deadpan and carefree. She speaks with a natural rhythm. There’s a quiet confidence beneath the awkward delivery. She rarely raises her voice, but her timing and phrasing are razor-sharp. Think ironic cool."
            },
            "androgynous_1": {
                "voice_id": "ballad",
                "description": "Moff doesn’t speak so much as emote through chaos. His voice is high-pitched, unpredictable, and stuffed with bizarre enthusiasm. Think a cross between a malfunctioning mascot and a hyper toddler on jelly beans."
            },
            "androgynous_2": {
                "voice_id": "coral",
                "description": "This speaker possesses the commanding gravitas and elegance of a Shakespearean titan — every word delivered with deliberate precision and dramatic weight. Her voice is rich, sonorous, and theatrical, as if trained to carry across a grand, empty stage. She speaks slowly, with thunderous pauses, dragging vowels for emphasis, and biting off consonants like punctuation marks in a duel."
            }
        };

        // Map character names to voice profiles
        this.characterVoiceMap = {
            "Line": "female_2",      
            "Bob": "male_2",       
            "Frank": "male_1", 
            "Victoire": "female_1", 
            "Gil": "androgynous_2",
            "Moff": "androgynous_1"    
        };
    }

    // Get user's voice profile based on their selection
    getUserVoiceProfile() {
        const userCharacterName = player.GetVar("UserCharacterName");
        console.log('User character name from Storyline:', userCharacterName);
        
        // First check if we have a valid character name
        if (!userCharacterName || !this.characterVoiceMap[userCharacterName]) {
            console.error('Invalid or missing character name:', userCharacterName);
            console.log('Available character mappings:', this.characterVoiceMap);
            // Set a default character
            player.SetVar("UserCharacterName", "Frank");
            const defaultProfile = this.userVoiceProfiles[this.characterVoiceMap["Frank"]];
            console.log('Using default profile (Frank):', defaultProfile);
            return defaultProfile;
        }
        
        // Get the voice profile type from the character map
        const voiceProfileType = this.characterVoiceMap[userCharacterName];
        console.log('Voice profile type from character map:', voiceProfileType);
        
        const voiceProfile = this.userVoiceProfiles[voiceProfileType];
        console.log('Final voice profile:', voiceProfile);
        
        return voiceProfile;
    }

    // Get user's help language
    getUserHelpLanguage() {
        return player.GetVar("UserHelpLang") || "en"; // Default to English if not set
    }

    // Get user's current success score
    getCurrentSuccess() {
        return parseFloat(player.GetVar("CurrentSuccess")) || 0;
    }

    // Update user's success score
    updateSuccessScore(newScore) {
        player.SetVar("CurrentSuccess", newScore.toString());
    }
}

// Create and export the handler instance
window.userSettingsHandler = new UserSettingsHandler(); 