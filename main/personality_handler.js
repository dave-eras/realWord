class PersonalityHandler {
    constructor() {
        this.personalityTypes = {
            "friendly": {
                tolerance_effects: {
                    high: { 
                        speaking_rate: 1, pitch: 2, emphasis: 2, pauses: 0,
                        intonation: 1, rhythm: 4, articulation: 1, volume: 3,
                        hesitation: 0, warmth: 2
                    },
                    medium: { 
                        speaking_rate: 1, pitch: 2, emphasis: 1, pauses: 0,
                        intonation: 1, rhythm: 4, articulation: 1, volume: 2,
                        hesitation: 0, warmth: 2
                    },
                    low: { 
                        speaking_rate: 0, pitch: 1, emphasis: 2, pauses: 2,
                        intonation: 2, rhythm: 1, articulation: 2, volume: 1,
                        hesitation: 2, warmth: 1
                    }
                }
            },
            "professional": {
                tolerance_effects: {
                    high: { 
                        speaking_rate: 1, pitch: 1, emphasis: 1, pauses: 0,
                        intonation: 1, rhythm: 4, articulation: 1, volume: 2,
                        hesitation: 0, warmth: 1
                    },
                    medium: { 
                        speaking_rate: 1, pitch: 0, emphasis: 1, pauses: 0,
                        intonation: 0, rhythm: 1, articulation: 1, volume: 1,
                        hesitation: 0, warmth: 1
                    },
                    low: { 
                        speaking_rate: 0, pitch: 2, emphasis: 2, pauses: 2,
                        intonation: 2, rhythm: 3, articulation: 2, volume: 1,
                        hesitation: 1, warmth: 0
                    }
                }
            },
            "grumpy": {
                tolerance_effects: {
                    high: { 
                        speaking_rate: 1, pitch: 0, emphasis: 0, pauses: 0,
                        intonation: 1, rhythm: 2, articulation: 0, volume: 2,
                        hesitation: 0, warmth: 1
                    },
                    medium: { 
                        speaking_rate: 2, pitch: 0, emphasis: 0, pauses: 0,
                        intonation: 1, rhythm: 0, articulation: 2, volume: 1,
                        hesitation: 2, warmth: 0
                    },
                    low: { 
                        speaking_rate: 2, pitch: 2, emphasis: 2, pauses: 0,
                        intonation: 2, rhythm: 3, articulation: 2, volume: 3,
                        hesitation: 0, warmth: 0
                    }
                }
            },
            "anxious": {
                tolerance_effects: {
                    high: { 
                        speaking_rate: 1, pitch: 1, emphasis: 2, pauses: 1,
                        intonation: 2, rhythm: 4, articulation: 0, volume: 2,
                        hesitation: 2, warmth: 2
                    },
                    medium: { 
                        speaking_rate: 2, pitch: 2, emphasis: 2, pauses: 2,
                        intonation: 2, rhythm: 3, articulation: 0, volume: 1,
                        hesitation: 2, warmth: 1
                    },
                    low: { 
                        speaking_rate: 2, pitch: 2, emphasis: 2, pauses: 2,
                        intonation: 2, rhythm: 3, articulation: 2, volume: 3,
                        hesitation: 2, warmth: 1
                    }
                }
            }
        };
    }

    getToleranceLevel(current_success, characterName) {
        // Get character data from npc_characters.json
        const characterData = window.npcCharacters?.characters?.[characterName];
        if (!characterData || !characterData.tolerance_thresholds) {
            console.warn(`No tolerance thresholds found for ${characterName}, using default thresholds`);
            if (current_success >= 0.8) return "high";
            if (current_success >= 0.4) return "medium";
            return "low";
        }

        const { high, medium } = characterData.tolerance_thresholds;
        console.log(`Tolerance thresholds for ${characterName}:`, { high, medium, current_success });
        
        if (current_success >= high) return "high";
        if (current_success >= medium) return "medium";
        return "low";
    }

    getAdjustedTone(personality, current_success, characterName, context = null) {
        const personalityType = this.personalityTypes[personality];
        if (!personalityType) return null;

        // Get tolerance level using character-specific thresholds
        const toleranceLevel = this.getToleranceLevel(current_success, characterName);
        console.log(`Tolerance level for ${characterName} with success ${current_success}:`, toleranceLevel);
        
        const rawSettings = personalityType.tolerance_effects[toleranceLevel];
        console.log('Raw settings:', rawSettings);

        // Convert numeric values to strings
        const settings = Object.entries(rawSettings).reduce((acc, [key, value]) => {
            acc[key] = value.toString();
            return acc;
        }, {});
        console.log('Converted settings:', settings);

        // Add context if provided
        if (context) {
            settings.context = context;
        }

        return { settings };
    }
}

// Create and export the handler instance
window.personalityHandler = new PersonalityHandler(); 