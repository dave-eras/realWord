// Function to get voice settings for an NPC character by character_id
function getNPCVoiceSettingsByCharacterId(characterId) {
    console.log('Getting voice settings for character ID:', characterId);
    
    // Check if npcCharacters is loaded
    if (!window.npcCharacters) {
        console.error('NPC characters data not loaded. Available window properties:', Object.keys(window));
        return {
            "voice_id": "alloy",  // Default voice ID
            "base_settings": {
                "speaking_rate": 1.0,
                "pitch": 1.0
            }
        };
    }
    
    console.log('Available NPC characters:', window.npcCharacters);
    
    // Find character by character_id
    const characters = window.npcCharacters?.characters;
    let characterData = null;
    let characterName = null;
    
    for (const [name, data] of Object.entries(characters || {})) {
        if (data.character_id === characterId) {
            characterData = data;
            characterName = name;
            break;
        }
    }
    
    if (!characterData) {
        console.warn(`No character data found for character ID ${characterId}, using default settings`);
        console.warn('Available characters:', Object.keys(window.npcCharacters?.characters || {}));
        return {
            "voice_id": "alloy",  // Default voice ID
            "base_settings": {
                "speaking_rate": 1.0,
                "pitch": 1.0
            }
        };
    }
    
    console.log('Found character data:', characterData);
    
    return {
        "voice_id": characterData.voice_id,
        "base_settings": characterData.base_settings,
        "personality": characterData.personality,
        "tolerance_thresholds": characterData.tolerance_thresholds,
        "character_name": characterName
    };
}

// Function to create structured tone instructions for mixed-tone text
function createStructuredToneInstructions(feedbackText, feedbackTone, newPromptText, newPromptTone, adjustedSettings) {
    let instructions = [];
    
    // Add specific tone instructions for each part
    if (feedbackText && feedbackTone) {
        instructions.push(`Speak "${feedbackText}" with a ${feedbackTone} tone.`);
    }
    
    if (newPromptText) {
        if (newPromptTone) {
            instructions.push(`Then speak "${newPromptText}" with a ${newPromptTone} tone.`);
        } else {
            instructions.push(`Then speak "${newPromptText}" with personality-adjusted tone.`);
        }
    }
    
    // Add overall delivery instructions based on adjusted settings
    const deliveryInstructions = [];
    
    // Speaking rate
    if (adjustedSettings.settings.speaking_rate === "0") {
        deliveryInstructions.push("slow and deliberate");
    } else if (adjustedSettings.settings.speaking_rate === "2") {
        deliveryInstructions.push("fast and urgent");
    } else {
        deliveryInstructions.push("natural pace");
    }
    
    // Pauses
    if (adjustedSettings.settings.pauses === "2") {
        deliveryInstructions.push("with extra pauses for clarity");
    } else if (adjustedSettings.settings.pauses === "1") {
        deliveryInstructions.push("with natural pauses");
    } else {
        deliveryInstructions.push("with minimal pauses");
    }
    
    // Intonation for questions
    if (newPromptText && newPromptText.includes("?")) {
        deliveryInstructions.push("use rising intonation on the question");
    }
    
    // Volume
    if (adjustedSettings.settings.volume === "1") {
        deliveryInstructions.push("quiet and subdued");
    } else if (adjustedSettings.settings.volume === "3") {
        deliveryInstructions.push("loud and clear");
    }
    
    if (deliveryInstructions.length > 0) {
        instructions.push(`Overall delivery: ${deliveryInstructions.join(", ")}.`);
    }
    
    return instructions.join(" ");
}

// Function to prepare NPC TTS request
function prepareNPCTTSRequest(interactionId) {
    try {
        console.log('Starting prepareNPCTTSRequest with ID:', interactionId);
        
        const numericId = Number(interactionId);
        const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
        
        if (!interaction) {
            console.error(`Interaction ${interactionId} not found`);
            return null;
        }

        // Use character_id instead of character_name to get voice settings
        const characterId = interaction.npc.character_id;
        const characterSettings = getNPCVoiceSettingsByCharacterId(characterId);
        
        // Get the current success value from Storyline using withCharacterSuccess
        const withCharacterSuccess = window.player.GetVar(`withCharacterSuccess_${characterId}`) || 0.5;
        console.log('Current character success value:', withCharacterSuccess);
        
        // Get text from feedback.text and new_prompt.text joined together
        let npcText = "";
        let feedbackText = "";
        let newPromptText = "";
        let feedbackTone = "";
        let newPromptTone = "";
        
        // Get feedback text and tone based on previous response (same logic as getNpcTextForFeedback)
        const prevResponseId = window.player.GetVar(`lastResponse_${numericId - 1}`);
        if (interaction.npc.feedback && Array.isArray(interaction.npc.feedback) && prevResponseId !== undefined && prevResponseId !== null) {
            // Find feedback by id (if feedback objects have an id), else by zero-based index
            const feedbackObj = interaction.npc.feedback.find((f, idx) => (f.id !== undefined ? f.id == prevResponseId : idx == prevResponseId));
            if (feedbackObj && feedbackObj.text) {
                feedbackText = feedbackObj.text;
                feedbackTone = feedbackObj.tone || "";
            }
        }
        
        // Get new_prompt text and tone (if available)
        if (interaction.npc.new_prompt && interaction.npc.new_prompt.text) {
            newPromptText = interaction.npc.new_prompt.text;
            newPromptTone = interaction.npc.new_prompt.tone || "";
        }
        
        // Combine the texts (same logic as getNpcTextForFeedback)
        if (feedbackText && newPromptText) {
            npcText = feedbackText + "\n" + newPromptText;
        } else if (feedbackText) {
            npcText = feedbackText;
        } else if (newPromptText) {
            npcText = newPromptText;
        }
        
        console.log('Previous response ID:', prevResponseId);
        console.log('NPC text to be spoken:', npcText);
        console.log('Feedback tone:', feedbackTone);
        console.log('New prompt tone:', newPromptTone);
        
        // Get adjusted tone settings based on personality and withCharacterSuccess
        const adjustedSettings = window.personalityHandler.getAdjustedTone(
            characterSettings.personality,
            withCharacterSuccess,
            characterSettings.character_name
        );
        
        if (!adjustedSettings) {
            console.error('Failed to get adjusted tone settings');
            return null;
        }
        
        console.log('Adjusted settings:', adjustedSettings);
        
        // Determine if we need structured tone instructions
        const hasToneChange = feedbackTone && newPromptTone && feedbackTone !== newPromptTone;
        const hasMixedTones = (feedbackTone && !newPromptTone) || (!feedbackTone && newPromptTone);
        const needsStructuredInstructions = hasToneChange || hasMixedTones;
        
        let instructions = "";
        let context = "";
        
        if (needsStructuredInstructions) {
            // Use structured tone instructions for mixed-tone text
            instructions = createStructuredToneInstructions(feedbackText, feedbackTone, newPromptText, newPromptTone, adjustedSettings);
            context = `Character: ${characterSettings.character_name} (${characterSettings.personality} personality).`;
        } else {
            // Use the existing TTS API handler's instruction creation
            // This will be handled by the tts_api_handler_2.js createInstructions method
            context = `Character: ${characterSettings.character_name} (${characterSettings.personality} personality).`;
        }
        
        console.log('Using structured instructions:', needsStructuredInstructions);
        console.log('Instructions:', instructions);
        
        // Get character data for description
        const characterData = window.npcCharacters?.characters?.[characterSettings.character_name];
        if (!characterData) {
            console.error(`No character data found for ${characterSettings.character_name}`);
            return null;
        }
        
        const ttsSettings = {
            text: npcText,
            voice_id: characterSettings.voice_id,
            settings: {
                speaking_rate: adjustedSettings.settings.speaking_rate,
                voice_settings: {
                    emphasis: adjustedSettings.settings.emphasis,
                    pauses: adjustedSettings.settings.pauses
                },
                phonetic_cues: {
                    intonation: adjustedSettings.settings.intonation,
                    rhythm: adjustedSettings.settings.rhythm,
                    articulation: adjustedSettings.settings.articulation,
                    volume: adjustedSettings.settings.volume,
                    pitch: adjustedSettings.settings.pitch
                },
                mannerisms: {
                    formality: adjustedSettings.settings.formality,
                    warmth: adjustedSettings.settings.warmth,
                    hesitation: adjustedSettings.settings.hesitation
                }
            },
            context: context,
            custom_instructions: needsStructuredInstructions ? instructions : null
        };
        
        return ttsSettings;
    } catch (error) {
        console.error('Error preparing NPC TTS request:', error);
        console.error('Error details:', {
            interactionId,
            toneConfig: window.toneConfig,
            interactionData: window.interactionData,
            npcCharacters: window.npcCharacters
        });
        return null;
    }
}

// Function to handle repeat request
function handleRepeatRequest(interactionId, characterSettings) {
    try {
        const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
        if (!interaction) {
            console.error(`Interaction ${interactionId} not found for repeat request`);
            return null;
        }

        // Get the actual text that was displayed to the user (feedback + new_prompt)
        const prevResponseId = window.player.GetVar(`lastResponse_${Number(interactionId) - 1}`);
        const originalText = window.getNpcTextForFeedback ? window.getNpcTextForFeedback(interaction, prevResponseId) : interaction.npc.text;
        const adjustedSettings = {
            text: originalText,
            settings: {
                voice_settings: { ...characterSettings.base_settings },
                phonetic_cues: {}
            }
        };

        // Apply personality-specific adjustments for repeat requests
        switch(characterSettings.personality) {
            case "friendly":
                adjustedSettings.text = `Sure, no problem. ${originalText}`;
                adjustedSettings.settings.voice_settings.speaking_rate = "0"; // Slightly slower
                adjustedSettings.settings.phonetic_cues.rhythm = "1"; 
                break;
                
            case "professional":
                adjustedSettings.text = `Of course. ${originalText}`;
                adjustedSettings.settings.voice_settings.speaking_rate = "0"; // Slightly slower
                adjustedSettings.settings.phonetic_cues.volume = "3";
                adjustedSettings.settings.phonetic_cues.rhythm = "1";  // Louder
                break;
                
            case "grumpy":
                adjustedSettings.text = `I said, ${originalText}`;
                adjustedSettings.settings.phonetic_cues.rhythm = "3"; // Staccato
                adjustedSettings.settings.phonetic_cues.articulation = "2"; // Sharp
                adjustedSettings.settings.phonetic_cues.volume = "3"; // Loud
                break;
                
            case "anxious":
                adjustedSettings.text = `Oh sorry! ${originalText}`;
                adjustedSettings.settings.voice_settings.speaking_rate = "0"; // Slower
                adjustedSettings.settings.phonetic_cues.intonation = "2"; // Rising
                break;
        }

        return adjustedSettings;
    } catch (error) {
        console.error('Error handling repeat request:', error);
        return null;
    }
}

// Function to get user voice settings
function getUserVoiceSettings() {
    // Get user settings from the UserSettingsHandler
    if (!window.userSettingsHandler) {
        console.error('UserSettingsHandler not found');
        return null;
    }

    const userProfile = window.userSettingsHandler.getUserVoiceProfile();
    if (!userProfile) {
        console.error('Failed to get user voice profile');
        return null;
    }

    return {
        "voice_id": userProfile.voice_id,
        "description": userProfile.description
    };
}

// Function to prepare user response TTS request
function prepareUserTTSRequest(buttonIndex) {
    try {
        // Get the current interaction ID
        const currentInteractionId = window.player.GetVar("currentInteractionId");
        const numericId = Number(currentInteractionId);
        
        // Find the current interaction
        const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
        if (!interaction) {
            console.error('Interaction not found for user TTS request');
            return null;
        }
        
        // Get the button text from the selected button
        const selectedButtonIndex = window.player.GetVar("selectedButtonIndex");
        const responseObj = JSON.parse(window.player.GetVar(`button_data_${selectedButtonIndex}`));
        
        // Get the user's voice settings
        const userVoiceSettings = getUserVoiceSettings();
        if (!userVoiceSettings) {
            console.error('Failed to get user voice settings');
            return null;
        }

        // Find the detailed response to get the tone
        const detailedResponse = interaction.detailed_responses?.find(r => r.text === responseObj.text);
        const tone = detailedResponse?.tone || 'neutral';

        // Create rich context for user response with tone as the primary instruction
        const context = `Character Description: ${userVoiceSettings.description}\n\n` +
                       `This text should be understood as a response to: "${interaction.npc.text}"\n\n` +
                       `IMPORTANT: The response MUST be delivered with a ${tone} tone. This overrides any conflicting tone in the character description.\n\n` +
                       `The response should maintain the appropriate tone while acknowledging the context of the previous statement.`;
        
        // Create the TTS settings object with full structure
        const ttsSettings = {
            text: responseObj.text,
            voice_id: userVoiceSettings.voice_id,
            context: context
        };

        console.log('User TTS settings:', {
            voiceProfile: userVoiceSettings,
            tone: tone,
            finalSettings: ttsSettings
        });

        return ttsSettings;
    } catch (error) {
        console.error('Error preparing user TTS request:', error);
        return null;
    }
}

// Function to handle user response TTS request
function handleUserTTSRequest(buttonIndex) {
    return new Promise((resolve, reject) => {
    try {
        const selectedButtonIndex = window.player.GetVar("selectedButtonIndex");
        const responseObj = JSON.parse(window.player.GetVar(`button_data_${selectedButtonIndex}`));
        const currentInteractionId = window.player.GetVar("currentInteractionId");
        const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(currentInteractionId));
        if (!interaction) {
            console.error('Interaction not found for user TTS request');
            return null;
        }
        // Dialogue-specific audio check
        if (interaction?.interaction_type === "dialogue") {
            const dialogueTurn = Number(window.player.GetVar("dialogueTurn"));
            const lineKey = `line_${dialogueTurn}`;
            const line = interaction[lineKey];
            if (!line || line.audio !== "yes") {
                console.log('Audio disabled for this dialogue user line');
                return;
            }
        } else {
            // Only proceed if audio is enabled for this response
            if (responseObj.audio !== "yes") {
                console.log('Audio disabled for this response');
                return;
            }
        }

        // Check if this is a repeat request
        if (responseObj.function === "ask_repeat") {
            const currentInteractionId = window.player.GetVar("currentInteractionId");
            const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(currentInteractionId));
            if (!interaction) {
                console.error('Interaction not found for repeat request');
                return;
            }

            // Get a random phrase from the root level repeat_phrases
            const repeatPhrases = window.interactionData.repeat_phrases;
            const randomPhrase = repeatPhrases[Math.floor(Math.random() * repeatPhrases.length)];
            
            // Get user voice settings for the initial phrase
            const userVoiceSettings = getUserVoiceSettings();
            if (!userVoiceSettings) {
                console.error('Failed to get user voice settings');
                return;
            }
            
            // First speak the user's "I don't understand" phrase in user's voice
            const userTtsSettings = {
                text: randomPhrase,
                voice_id: userVoiceSettings.voice_id,
                context: `Character Description: ${userVoiceSettings.description}\nThis is a request for clarification, so the tone should reflect that.`
            };

            // Play the user's phrase first, then trigger the NPC repeat
            window.ttsAPIHandler.speak(userTtsSettings).then(() => {
                const characterName = window.player.GetVar("npcName");
                if (!characterName) {
                    console.error('No character name found - initializeOptions may not have run');
                    return;
                }
                
                const characterSettings = getNPCVoiceSettingsByCharacterId(interaction.npc.character_id);
                const characterData = window.npcCharacters?.characters?.[characterName];
                if (!characterData) {
                    console.error(`No character data found for ${characterName}`);
                    return;
                }
                
                const repeatSettings = handleRepeatRequest(currentInteractionId, characterSettings);
                if (repeatSettings) {
                    const ttsSettings = {
                        text: repeatSettings.text,
                        voice_id: characterSettings.voice_id,
                        settings: {
                            ...characterSettings.base_settings,
                            ...repeatSettings.settings
                        },
                        context: `Character Description: ${characterData.description}\nThis should inform the overall delivery style and demeanor of the speech.`
                    };
                    window.ttsAPIHandler.speak(ttsSettings);
                }
            });
            return;
        }

        // Handle normal user response
        const ttsSettings = prepareUserTTSRequest(buttonIndex);
        if (!ttsSettings) {
            console.error('Failed to prepare user TTS settings');
            return Promise.resolve(); // Return resolved promise if no TTS
        }
        
        return window.ttsAPIHandler.speak(ttsSettings).then(resolve).catch(reject);
    } catch (error) {
        console.error('Error in handleUserTTSRequest:', error);
        reject(error);
    }
    });
}

// Function to handle NPC TTS request
function handleNPCTTSRequest(interactionId, dialogueTurnOverride) {
    const numericId = Number(interactionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    // Dialogue-specific audio check
    if (interaction?.interaction_type === "dialogue") {
        // Use the override if provided, otherwise get from player
        const dialogueTurn = (typeof dialogueTurnOverride === "number") ? dialogueTurnOverride : Number(window.player.GetVar("dialogueTurn"));
        const lineKey = `line_${dialogueTurn}`;
        const line = interaction[lineKey];
        console.log("handleNPCTTSRequest: dialogue lineKey", lineKey, line);
        if (!line || line.audio !== "yes") {
            console.log('Audio disabled for this dialogue line');
            return;
        }
        // Prepare and play TTS for this line
        const ttsSettings = prepareNPCTTSRequestForLine(line, interaction, dialogueTurn);
        if (!ttsSettings) {
            console.error('Failed to prepare NPC TTS settings for dialogue line');
            return;
        }
        window.ttsAPIHandler.speak(ttsSettings);
        return;
    } else {
        // Only proceed if audio is enabled for this NPC response
        if (interaction?.npc?.audio !== "yes") {
            console.log('Audio disabled for this NPC response');
            return;
        }
        const ttsSettings = prepareNPCTTSRequest(interactionId);
        if (!ttsSettings) {
            console.error('Failed to prepare NPC TTS settings');
            return;
        }
        window.ttsAPIHandler.speak(ttsSettings);
    }
}

// Helper to prepare TTS for a dialogue line
function prepareNPCTTSRequestForLine(line, interaction, dialogueTurn) {
    // Check if this is a dynamic line with variants
    if (line && line.dynamic_variants) {
        // This is a dynamic line, get the variant info
        const variantKey = window.selectDynamicLine ? window.selectDynamicLine(interaction, dialogueTurn) : null;
        if (variantKey && line.dynamic_variants[variantKey]) {
            const variant = line.dynamic_variants[variantKey];
            
            // Get the previous line for context
            const previousLineKey = `line_${dialogueTurn - 1}`;
            const previousLine = interaction[previousLineKey];
            const previousText = previousLine ? previousLine.text : "";
            const previousSpeaker = previousLine ? previousLine.character_name : "";
            
            // Get the constructed text (this should already be done by constructFeedbackFromConfig)
            let constructedText = window.player.GetVar("npcText") || variant.text;
            
            // Validate and clean the text
            if (!constructedText || typeof constructedText !== 'string') {
                console.error("Invalid constructed text:", constructedText);
                constructedText = variant.text || "Error: No text available";
            }
            
            // Remove any problematic characters that might cause TTS API issues
            constructedText = constructedText.replace(/[^\w\s.,!?;:'"()-]/g, '');
            
            // Check for any remaining placeholders that weren't replaced
            if (constructedText.includes('{') || constructedText.includes('}')) {
                console.error("Found unreplaced placeholders in text:", constructedText);
                // Remove any remaining placeholders
                constructedText = constructedText.replace(/\{[^}]*\}/g, '');
            }
            
            console.log("TTS Debug - Dynamic variant text:", {
                variantKey,
                originalText: window.player.GetVar("npcText"),
                fallbackText: variant.text,
                finalText: constructedText
            });
            
            // Create context with the previous line
            const context = previousText ? 
                `Previous line (${previousSpeaker}): "${previousText}"\n\n` +
                `Current response (${variant.character_name}): "${constructedText}"\n\n` +
                `Tone: ${variant.tone || 'neutral'}` :
                `First line of dialogue (${variant.character_name}): "${constructedText}"\n\n` +
                `Tone: ${variant.tone || 'neutral'}`;
            
            const ttsSettings = {
                text: constructedText,
                voice_id: getNPCVoiceSettingsByCharacterId(variant.character_id).voice_id,
                settings: getNPCVoiceSettingsByCharacterId(variant.character_id).base_settings,
                context: context
            };
            
            console.log("TTS Debug - Final settings for dynamic variant:", ttsSettings);
            
            return ttsSettings;
        } else {
            console.error("Variant not found for dynamic line:", variantKey);
            return null;
        }
    } else {
        // Regular line with direct properties
        // Get the previous line for context
        const previousLineKey = `line_${dialogueTurn - 1}`;
        const previousLine = interaction[previousLineKey];
        const previousText = previousLine ? previousLine.text : "";
        const previousSpeaker = previousLine ? previousLine.character_name : "";
        
        // Create context with the previous line
        const context = previousText ? 
            `Previous line (${previousSpeaker}): "${previousText}"\n\n` +
            `Current response (${line.character_name}): "${line.text}"\n\n` +
            `Tone: ${line.tone || 'neutral'}` :
            `First line of dialogue (${line.character_name}): "${line.text}"\n\n` +
            `Tone: ${line.tone || 'neutral'}`;
        
        return {
            text: line.text,
            voice_id: getNPCVoiceSettingsByCharacterId(line.character_id).voice_id,
            settings: getNPCVoiceSettingsByCharacterId(line.character_id).base_settings,
            context: context
        };
    }
}

// Helper to prepare TTS for a dialogue user line
function prepareUserTTSRequestForLine(line, interaction, dialogueTurn) {
    try {
        // Get the user's voice settings
        const userVoiceSettings = getUserVoiceSettings();
        if (!userVoiceSettings) {
            console.error('Failed to get user voice settings');
            return null;
        }

        // Get the previous line for context
        const previousLineKey = `line_${dialogueTurn - 1}`;
        const previousLine = interaction[previousLineKey];
        const previousText = previousLine ? previousLine.text : "";
        const previousSpeaker = previousLine ? previousLine.character_name : "";
        
        // Create context with the previous line
        const context = previousText ? 
            `Previous line (${previousSpeaker}): "${previousText}"\n\n` +
            `Current response (User): "${line.text}"\n\n` +
            `Tone: ${line.tone || 'neutral'}` :
            `First line of dialogue (User): "${line.text}"\n\n` +
            `Tone: ${line.tone || 'neutral'}`;
        
        // Create the TTS settings object with full structure
        const ttsSettings = {
            text: line.text,
            voice_id: userVoiceSettings.voice_id,
            context: context
        };

        console.log('User dialogue TTS settings:', {
            voiceProfile: userVoiceSettings,
            tone: line.tone,
            finalSettings: ttsSettings
        });

        return ttsSettings;
    } catch (error) {
        console.error('Error preparing user dialogue TTS request:', error);
        return null;
    }
}

// Function to handle record TTS request
function handleReordTTSRequest(text) {
    return new Promise((resolve, reject) => {
        try {
            // Get the user's voice settings
            const userVoiceSettings = getUserVoiceSettings();
            if (!userVoiceSettings) {
                console.error('Failed to get user voice settings');
                resolve(); // Resolve immediately if no voice settings
                return;
            }

            // Create a context for the TTS request
            const context = `Character Description: ${userVoiceSettings.description}\n\nThis is a user reorder response.`;

            // Prepare TTS settings for reorder response
            const ttsSettings = {
                text: text,
                voice_id: userVoiceSettings.voice_id,
                context: context
            };
            window.ttsAPIHandler.speak(ttsSettings).then(resolve).catch(reject);
        } catch (error) {
            console.error('Error in handleReordTTSRequest:', error);
            reject(error);
        }
    });
}

// Export functions for use in Storyline
window.handleNPCTTSRequest = handleNPCTTSRequest;
window.handleUserTTSRequest = handleUserTTSRequest;
window.handleReordTTSRequest = handleReordTTSRequest;
window.prepareNPCTTSRequest = prepareNPCTTSRequest;
window.prepareNPCTTSRequestForLine = prepareNPCTTSRequestForLine;
window.prepareUserTTSRequest = prepareUserTTSRequest;
window.prepareUserTTSRequestForLine = prepareUserTTSRequestForLine;
window.getNPCVoiceSettingsByCharacterId = getNPCVoiceSettingsByCharacterId; 