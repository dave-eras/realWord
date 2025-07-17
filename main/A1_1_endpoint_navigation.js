// Endpoint Navigation Configuration
// This file contains rules for setting GoToEndPoint and lastResponse variables
// based on specific interaction conditions

// Configuration object for easy customization
window.endpointNavigationConfig = {
    // The variable names to use for the last responses (e.g., "lastResponse_9", "lastResponse_13", etc.)
    // You can add as many as you need by just adding more entries
    lastResponseVariableNames: [
        "lastResponse_12",
        "lastResponse_2" 
        // Add more as needed: "lastResponse_21", "lastResponse_25", etc.
    ],
    
    // Enable/disable debug logging
    debugMode: true
};

window.endpointNavigationRules = {
    // Rules for "consequences" - interactions that need both goToEndPoint and lastResponse
    consequenceRules: [
        {
            interactionId: 8, //the slide number that branches to 2 or more others
            responseId: 2, //reponseId is found at the top of detailed_responses
            goToEndPoint: "True", // when this changes in storyline, there is a jump to slide
            lastResponseIndex: 0,  // Uses first variable from the list above
            lastResponse: 3, // this sets which feedback to show interaction last_response_x+1
        },
        {
            interactionId: 11,
            responseId: 0,
            goToEndPoint: "True", 
            lastResponseIndex: 0,  
            lastResponse: 1,
        }
        // Add more consequence rules here as needed
    ],
    
    // Rules for "choices" - interactions that need goToEndPoint and lastResponse for content selection
    choiceRules: [
        {
            interactionId: 2,
            responseId: 0,
            goToEndPoint: "True",
            lastResponseIndex: 1,  // Uses lastResponse_2
            lastResponse: 0,       // Guacamole content
            description: "Guacamole"
        },
        {
            interactionId: 2,
            responseId: 1,
            goToEndPoint: "True",
            lastResponseIndex: 1,  // Uses lastResponse_2
            lastResponse: 1,       // Stuffed mushrooms content
            description: "Stuffed mushrooms"
        }
        // Add more choice rules here as needed
    ],
    
    // Rules for reorder interactions - works in exactly the same way as consequence rules, but uses the interactionSuccess variable instead of responseObj.id
    reorderRules: [
        {
            interactionId: 10,
            successScore: 0.1, // Check the actual interaction success score, not the weight
            goToEndPoint: "True",
            lastResponseIndex: 0,  // Uses first variable (lastResponse_9)
            lastResponse: 4,
        }
        // Add more reorder rules here as needed
    ],
    
    // Rules for multichoice interactions - uses success level (high/medium/low) instead of responseObj.id
    multichoiceRules: [
        // Example rule (uncomment and modify as needed):
        // {
        //     interactionId: 3,
        //     successLevel: "high", // "high", "medium", or "low"
        //     goToEndPoint: "True",
        //     lastResponseIndex: 0,  // Uses first variable from the list above
        //     lastResponse: 5,
        //     description: "High performance multichoice triggers endpoint"
        // }
        // Add more multichoice rules here as needed
    ],
    
    // Rules for dialogue interactions - triggered when dialogue completes
    dialogueRules: [
        // Example rule (uncomment and modify as needed):
        // {
        //     interactionId: 4,
        //     goToEndPoint: "True",
        //     lastResponseIndex: 0,  // Uses first variable from the list above
        //     lastResponse: 6,
        //     description: "Dialogue completion triggers endpoint"
        // }
        // Add more dialogue rules here as needed
    ]
};

// Helper function to log debug information
function logDebug(message, data = null) {
    if (window.endpointNavigationConfig.debugMode) {
        console.log(`[Endpoint Navigation] ${message}`);
        if (data !== null) {
            console.log(data);
        }
    }
}

// Function to check and apply endpoint navigation rules
function checkAndApplyEndpointRules(interactionId, responseObj, interactionType, currentStage, interaction, waitForTTS = false) {
    // ALWAYS log when this function is called, regardless of parameters
    console.log("🔍 checkAndApplyEndpointRules CALLED with:", {
        interactionId,
        responseObj,
        interactionType,
        currentStage,
        waitForTTS,
        interaction: interaction ? interaction.interaction_id : 'undefined'
    });
    
    logDebug("=== Endpoint Navigation Debug ===");
    logDebug(`interactionId: ${interactionId}`);
    logDebug(`responseObj:`, responseObj);
    logDebug(`interactionType: ${interactionType}`);
    logDebug(`currentStage: ${currentStage}`);
    logDebug(`interaction:`, interaction);
    logDebug(`waitForTTS: ${waitForTTS}`);
    
    // SAFEGUARD: Check if currentInteractionId has changed since this function was called
    // This prevents stale calls from TTS completion callbacks
    const currentInteractionId = player.GetVar("currentInteractionId");
    if (currentInteractionId && Number(currentInteractionId) !== interactionId) {
        logDebug(`❌ BLOCKED: Interaction ID mismatch - function called for ${interactionId} but currentInteractionId is ${currentInteractionId}`);
        logDebug("This is likely a stale call from a TTS completion callback after slide navigation");
        logDebug("=== End of Endpoint Navigation Debug ===");
        return false;
    }
    
    // SAFEGUARD: Block repeat requests from affecting navigation or feedback
    if (responseObj && responseObj.function === "ask_repeat") {
        logDebug("❌ BLOCKED: Repeat request detected - no navigation or feedback changes allowed");
        logDebug("Repeat requests should only trigger TTS, not affect game state");
        logDebug("=== End of Endpoint Navigation Debug ===");
        return false;
    }
    
    // SAFEGUARD: Prevent NPC TTS from triggering endpoint navigation
    // Check if this is being called after NPC TTS (which should never happen)
    const isSpeechPlaying = player.GetVar("isSpeechPlaying");
    const npcText = player.GetVar("npcText");
    
    // For multichoice interactions, only allow endpoint navigation when user submits
    // NPC TTS should never trigger endpoint navigation
    if (interactionType === "multichoice" && currentStage === "multichoice") {
        // Check if this is being called after NPC TTS (which would be wrong)
        // If npcText is set and we're in multichoice stage, this is likely after NPC TTS
        if (npcText && !responseObj.id && !responseObj.successLevel) {
            logDebug("❌ BLOCKED: This appears to be after NPC TTS in multichoice - endpoint navigation should not be triggered by NPC speech");
            logDebug("=== End of Endpoint Navigation Debug ===");
            return false;
        }
    }
    
    // Additional safeguard: Check if this is being called after any NPC TTS
    // If we have npcText set and no valid responseObj, this is likely after NPC TTS
    // EXCEPTION: Dialogue interactions are exempt from this safeguard since they need to trigger endpoint navigation when dialogue completes
    if (interactionType !== "dialogue" && npcText && (!responseObj || (!responseObj.id && !responseObj.successLevel && !responseObj.reordResponse))) {
        logDebug("❌ BLOCKED: This appears to be after NPC TTS - endpoint navigation should not be triggered by NPC speech");
        logDebug("=== End of Endpoint Navigation Debug ===");
        return false;
    }
    
    if (isSpeechPlaying === "yes" && npcText && interactionType !== "dialogue") {
        logDebug("❌ BLOCKED: NPC TTS is playing - endpoint navigation should not be triggered by NPC speech");
        logDebug("=== End of Endpoint Navigation Debug ===");
        return false;
    }
    
    const rules = window.endpointNavigationRules;
    const config = window.endpointNavigationConfig;
    logDebug("Available rules:", rules);
    
    // Check response stage rules for one-step and two-step interactions
    if ((interactionType === "one-step" || interactionType === "two-step") && currentStage === "response") {
        logDebug("Checking response stage rules...");
        
        // First check consequence rules (need both goToEndPoint and lastResponse)
        for (const rule of rules.consequenceRules) {
            logDebug("Checking consequence rule:", rule);
            logDebug(`Rule condition - interactionId === rule.interactionId: ${interactionId === rule.interactionId}`);
            logDebug(`Rule condition - responseObj.id === rule.responseId: ${Number(responseObj.id) === rule.responseId}`);
            
            if (interactionId === rule.interactionId && Number(responseObj.id) === rule.responseId) {
                logDebug(`✅ Applying consequence rule: ${rule.description}`);
                applyEndpointRule(rule, waitForTTS);
                return true; // Rule applied
            }
        }
        
        // Then check choice rules (need goToEndPoint and lastResponse for content selection)
        for (const rule of rules.choiceRules) {
            logDebug("Checking choice rule:", rule);
            logDebug(`Rule condition - interactionId === rule.interactionId: ${interactionId === rule.interactionId}`);
            logDebug(`Rule condition - responseObj.id === rule.responseId: ${Number(responseObj.id) === rule.responseId}`);
            
            if (interactionId === rule.interactionId && Number(responseObj.id) === rule.responseId) {
                logDebug(`✅ Applying choice rule: ${rule.description}`);
                applyEndpointRule(rule, waitForTTS);
                return true; // Rule applied
            }
        }
        
        logDebug("❌ No response stage rules matched");
    } else {
        logDebug("❌ Not checking response stage rules - conditions not met:");
        logDebug(`  interactionType check: ${interactionType === "one-step" || interactionType === "two-step"}`);
        logDebug(`  currentStage check: ${currentStage === "response"}`);
    }
    
    // Check reorder rules
    if (interactionType === "reord" && currentStage === "reord") {
        logDebug("Checking reorder rules...");
        const currentInteractionSuccess = player.GetVar("interactionSuccess") || 0;
        logDebug(`Current interaction success score: ${currentInteractionSuccess}`);
        
        for (const rule of rules.reorderRules) {
            logDebug("Checking reorder rule:", rule);
            logDebug(`Rule condition - interactionId === rule.interactionId: ${interactionId === rule.interactionId}`);
            logDebug(`Rule condition - success score check: ${currentInteractionSuccess === rule.successScore}`);
            
            if (interactionId === rule.interactionId && currentInteractionSuccess === rule.successScore) {
                logDebug(`✅ Applying reorder endpoint rule: ${rule.description}`);
                applyEndpointRule(rule, waitForTTS);
                return true; // Rule applied
            }
        }
        logDebug("❌ No reorder rules matched");
    } else {
        logDebug("❌ Not checking reorder rules - conditions not met:");
        logDebug(`  interactionType check: ${interactionType === "reord"}`);
        logDebug(`  currentStage check: ${currentStage === "reord"}`);
    }
    
    // Check multichoice rules
    if (interactionType === "multichoice" && currentStage === "multichoice") {
        logDebug("Checking multichoice rules...");
        const successScore = responseObj.successScore || 0;
        const successLevel = responseObj.successLevel || "low";
        logDebug(`Multichoice success score: ${successScore}, level: ${successLevel}`);
        
        for (const rule of rules.multichoiceRules || []) {
            logDebug("Checking multichoice rule:", rule);
            logDebug(`Rule condition - interactionId === rule.interactionId: ${interactionId === rule.interactionId}`);
            logDebug(`Rule condition - success level check: ${successLevel === rule.successLevel}`);
            
            if (interactionId === rule.interactionId && successLevel === rule.successLevel) {
                logDebug(`✅ Applying multichoice endpoint rule: ${rule.description}`);
                applyEndpointRule(rule, waitForTTS);
                return true; // Rule applied
            }
        }
        logDebug("❌ No multichoice rules matched");
    } else {
        logDebug("❌ Not checking multichoice rules - conditions not met:");
        logDebug(`  interactionType check: ${interactionType === "multichoice"}`);
        logDebug(`  currentStage check: ${currentStage === "multichoice"}`);
    }
    
    // Check dialogue rules
    if (interactionType === "dialogue") {
        logDebug("Checking dialogue rules...");
        const dialogueComplete = responseObj.dialogueComplete || false;
        logDebug(`Dialogue complete: ${dialogueComplete}`);
        
        for (const rule of rules.dialogueRules || []) {
            logDebug("Checking dialogue rule:", rule);
            logDebug(`Rule condition - interactionId === rule.interactionId: ${interactionId === rule.interactionId}`);
            
            if (interactionId === rule.interactionId) {
                logDebug(`✅ Applying dialogue endpoint rule: ${rule.description}`);
                applyEndpointRule(rule, waitForTTS);
                return true; // Rule applied
            }
        }
        logDebug("❌ No dialogue rules matched");
    } else {
        logDebug("❌ Not checking dialogue rules - conditions not met:");
        logDebug(`  interactionType check: ${interactionType === "dialogue"}`);
    }
    
    logDebug("=== End of Endpoint Navigation Debug ===");
    
    // If no rules were applied, set GoToEndPoint to "False" after TTS completion
    // This ensures all navigation decisions are based on GoToEndPoint
    logDebug("No endpoint rules applied - will set GoToEndPoint to: False after TTS");
    
    // Set GoToEndPoint to "False" after TTS completion (same timing as when rules apply)
    const checkTTSCompletion = () => {
        const isSpeechPlaying = player.GetVar("isSpeechPlaying");
        if (isSpeechPlaying === "no" || isSpeechPlaying === undefined) {
            // TTS has finished, set GoToEndPoint to False
            player.SetVar("GoToEndPoint", "False");
            logDebug(`Set GoToEndPoint to: False (after TTS completion - no rules)`);
        } else {
            // TTS is still playing, check again in a moment
            setTimeout(checkTTSCompletion, 50);
        }
    };
    
    // Start checking for TTS completion
    setTimeout(checkTTSCompletion, 50);
    
    return false; // No rules applied
}

// Helper function to apply endpoint rules
function applyEndpointRule(rule, waitForTTS = false) {
    // ALWAYS log when this function is called
    console.log("🎯 applyEndpointRule CALLED with:", {
        rule,
        waitForTTS
    });
    
    const config = window.endpointNavigationConfig;
    
    // Set lastResponse FIRST (so it's available when GoToEndPoint triggers)
    if (rule.lastResponse !== undefined && rule.lastResponseIndex !== undefined) {
        const variableName = config.lastResponseVariableNames[rule.lastResponseIndex];
        if (variableName) {
            player.SetVar(variableName, rule.lastResponse);
            logDebug(`Set ${variableName} to: ${rule.lastResponse}`);
        } else {
            logDebug(`❌ Invalid lastResponseIndex: ${rule.lastResponseIndex}`);
        }
    } else {
        logDebug("No lastResponse properties found - this is a choice rule");
    }
    
    // Then set GoToEndPoint - either immediately or after TTS completion
    if (rule.goToEndPoint !== undefined) {
        if (waitForTTS) {
            // Wait for TTS to complete before setting GoToEndPoint
            logDebug("Waiting for TTS to complete before setting GoToEndPoint...");
            
            // Check if speech is currently playing
            const checkTTSCompletion = () => {
                const isSpeechPlaying = player.GetVar("isSpeechPlaying");
                if (isSpeechPlaying === "no" || isSpeechPlaying === undefined) {
                    // TTS has finished, set GoToEndPoint
                    player.SetVar("GoToEndPoint", rule.goToEndPoint);
                    logDebug(`Set GoToEndPoint to: ${rule.goToEndPoint} (after TTS completion)`);
                } else {
                    // TTS is still playing, check again in a moment
                    setTimeout(checkTTSCompletion, 50);
                }
            };
            
            // Start checking for TTS completion
            setTimeout(checkTTSCompletion, 50);
        } else {
            // Set GoToEndPoint immediately
            player.SetVar("GoToEndPoint", rule.goToEndPoint);
            logDebug(`Set GoToEndPoint to: ${rule.goToEndPoint} (immediately)`);
        }
    } else {
        // No GoToEndPoint specified in rule, set to "False" after TTS completion
        logDebug("No GoToEndPoint in rule - will set GoToEndPoint to: False after TTS");
        
        // Set GoToEndPoint to "False" after TTS completion (same timing as when rules apply)
        const checkTTSCompletion = () => {
            const isSpeechPlaying = player.GetVar("isSpeechPlaying");
            if (isSpeechPlaying === "no" || isSpeechPlaying === undefined) {
                // TTS has finished, set GoToEndPoint to False
                player.SetVar("GoToEndPoint", "False");
                logDebug(`Set GoToEndPoint to: False (after TTS completion - no GoToEndPoint in rule)`);
            } else {
                // TTS is still playing, check again in a moment
                setTimeout(checkTTSCompletion, 50);
            }
        };
        
        // Start checking for TTS completion
        setTimeout(checkTTSCompletion, 50);
    }
}

// Function to update configuration (useful for dynamic changes)
function updateEndpointNavigationConfig(newConfig) {
    Object.assign(window.endpointNavigationConfig, newConfig);
    logDebug("Updated endpoint navigation configuration:", window.endpointNavigationConfig);
}

// Function to add a new response stage rule
function addResponseStageRule(rule) {
    window.endpointNavigationRules.consequenceRules.push(rule);
    logDebug("Added new response stage rule:", rule);
}

// Function to add a new reorder rule
function addReorderRule(rule) {
    window.endpointNavigationRules.reorderRules.push(rule);
    logDebug("Added new reorder rule:", rule);
}

// Function to remove a rule by description
function removeRuleByDescription(description, ruleType = "consequence") {
    const rules = ruleType === "reorder" ? 
        window.endpointNavigationRules.reorderRules : 
        window.endpointNavigationRules.consequenceRules;
    
    const index = rules.findIndex(rule => rule.description === description);
    if (index !== -1) {
        const removedRule = rules.splice(index, 1)[0];
        logDebug(`Removed ${ruleType} rule:`, removedRule);
        return true;
    }
    logDebug(`No ${ruleType} rule found with description: ${description}`);
    return false;
}

// Export functions for use in other files
window.checkAndApplyEndpointRules = checkAndApplyEndpointRules;
window.applyEndpointRule = applyEndpointRule;
window.logDebug = logDebug;
window.updateEndpointNavigationConfig = updateEndpointNavigationConfig;
window.addResponseStageRule = addResponseStageRule;
window.addReorderRule = addReorderRule;
window.removeRuleByDescription = removeRuleByDescription; 