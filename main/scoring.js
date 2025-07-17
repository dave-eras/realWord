// Scoring System for Real World Interactions
// Handles one-step and two-step interactions with character and overall success tracking

// Function to calculate interaction success score
function calculateInteractionSuccess(interaction, userResponse, interactionStage) {
    let interactionSuccess = 0; // Start at 0 as per requirements
    let matchInfo = null; // For storing reorder match information
    
    if (interaction.interaction_type === "one-step") {
        // For one-step interactions, calculate based on detailed_response matches
        interactionSuccess = calculateOneStepSuccess(interaction, userResponse);
    } else if (interaction.interaction_type === "end-point") {
        // For end-point interactions, calculate like one-step interactions
        interactionSuccess = calculateOneStepSuccess(interaction, userResponse);
    } else if (interaction.interaction_type === "reord") {
        // For reorder interactions
        const reordResult = calculateReordSuccess(interaction, userResponse);
        interactionSuccess = reordResult.score;
        // Note: Match info is now calculated directly in text_handler.js
    } else if (interaction.interaction_type === "multichoice") {
        // For multichoice interactions, use the pre-calculated success score
        interactionSuccess = userResponse.successScore || 0;
    } else {
        // For two-step interactions, calculate based on stage
        if (interactionStage === "understanding") {
            interactionSuccess = calculateTwoStepUnderstandingSuccess(interaction, userResponse);
        } else {
            // detailed_response stage
            interactionSuccess = calculateTwoStepResponseSuccess(interaction, userResponse);
        }
    }
    
    // Ensure score stays between 0 and 1
    return Math.max(0, Math.min(1, interactionSuccess));
}

// Calculate success for one-step interactions
function calculateOneStepSuccess(interaction, userResponse) {
    let score = 0;
    const expectations = interaction.expectations;
    const successWeights = interaction.success_weights;
    const currentInteractionId = player.GetVar("currentInteractionId");
    
    // Only add points for matches
    if (userResponse.topic === expectations.topic) {
        score += successWeights.topic;
    }
    if (expectations.function && Array.isArray(expectations.function) && expectations.function.includes(userResponse.function)) {
        score += successWeights.function;
    }
    if (expectations.tone && Array.isArray(expectations.tone) && expectations.tone.includes(userResponse.tone)) {
        score += successWeights.tone;
    }
    if (expectations.formality && Array.isArray(expectations.formality) && expectations.formality.includes(userResponse.formality)) {
        score += successWeights.formality;
    }
    
    console.log(`interactionSuccess: ${score} (one-step, interactionId: ${currentInteractionId})`);
    return score;
}

// Calculate success for two-step understanding stage
function calculateTwoStepUnderstandingSuccess(interaction, userResponse) {
    const expectations = interaction.expectations;
    const successWeights = interaction.success_weights;
    const attempts = player.GetVar("understandingAttempts") || 0;
    const currentInteractionId = player.GetVar("currentInteractionId");
    let multiplier = 1.0;
    if (attempts === 1) {
        multiplier = 0.5;
    } else if (attempts > 1) {
        multiplier = 0;
    }

    // Calculate raw score for this attempt (sum of matches)
    let rawScore = 0;
    if (userResponse.topic === expectations.topic) {
        rawScore += successWeights.understanding_stage.topic;
    }
    if (expectations.function.includes(userResponse.function)) {
        rawScore += successWeights.understanding_stage.function;
    }

    const score = rawScore * multiplier;
    console.log(`interactionSuccess: ${score} (understanding stage, attempts: ${attempts}, raw: ${rawScore}, multiplier: ${multiplier}, interactionId: ${currentInteractionId})`);
    return score;
}

// Calculate success for two-step detailed_response stage
function calculateTwoStepResponseSuccess(interaction, userResponse) {
    const currentInteractionSuccess = player.GetVar("interactionSuccess");
    let score = currentInteractionSuccess !== undefined ? currentInteractionSuccess : 0;
    const expectations = interaction.expectations;
    const successWeights = interaction.success_weights;
    const currentInteractionId = player.GetVar("currentInteractionId");

    // Track matches and weights
    let rawScore = 0;
    const toneMatch = expectations.tone.includes(userResponse.tone);
    const formalityMatch = expectations.formality.includes(userResponse.formality);
    const toneWeight = successWeights.response_stage.tone;
    const formalityWeight = successWeights.response_stage.formality;

    if (toneMatch) {
        rawScore += toneWeight;
        score += toneWeight;
    }
    if (formalityMatch) {
        rawScore += formalityWeight;
        score += formalityWeight;
    }

    console.log(`interactionSuccess: ${score} (response stage, interactionId: ${currentInteractionId}, raw: ${rawScore}, tone match: ${toneMatch}, formality match: ${formalityMatch}, tone weight: ${toneWeight}, formality weight: ${formalityWeight})`);
    return score;
}

// Function to update character-specific success tracking
function updateCharacterSuccess(interaction, interactionSuccess, isResponseStage = false) {
    const characterId = interaction.npc.character_id;
    const currentInteractionId = player.GetVar("currentInteractionId");
    
    // Get current character TOTAL and count from their dedicated variables
    let characterSuccessTotal = player.GetVar(`withCharacterSuccess_total_${characterId}`) || 0;
    let characterInteractionCount = player.GetVar(`characterInteractionCount_${characterId}`) || 1; // Start at 1
    
    // Only increment count at response stage AND not for first interaction (ID = 1)
    if (isResponseStage && String(currentInteractionId) !== "1") {
        characterInteractionCount += 1;
        player.SetVar(`characterInteractionCount_${characterId}`, characterInteractionCount);
    }
    
    // Update success total - only at response stage
    if (isResponseStage) {
        characterSuccessTotal += interactionSuccess;
        player.SetVar(`withCharacterSuccess_total_${characterId}`, characterSuccessTotal);
    }
    
    // Calculate average (use characterInteractionCount as denominator)
    const averageCharacterSuccess = characterSuccessTotal / characterInteractionCount;
    
    // Cap the average at 1.0
    const cappedAverageCharacterSuccess = Math.min(1.0, averageCharacterSuccess);
    
    // Store the average in the original variable
    player.SetVar(`withCharacterSuccess_${characterId}`, cappedAverageCharacterSuccess);
    
    console.log(`withCharacterSuccess_${characterId}: ${cappedAverageCharacterSuccess} (${characterSuccessTotal}/${characterInteractionCount}, interactionId: ${currentInteractionId})`);
}

// Function to update overall success tracking
function updateOverallSuccess(interactionSuccess, isResponseStage = false) {
    const currentInteractionId = player.GetVar("currentInteractionId");
    
    // Get current overall success total and count
    let overallSuccessTotal = player.GetVar("overallSuccess_total") || 0;
    let totalInteractionCount = player.GetVar("totalInteractionCount") || 1; // Start at 1
    
    // Only increment count at response stage AND not for first interaction (ID = 1)
    if (isResponseStage && String(currentInteractionId) !== "1") {
        totalInteractionCount += 1;
        player.SetVar("totalInteractionCount", totalInteractionCount);
    }
    
    // Update success total - only at response stage
    if (isResponseStage) {
        overallSuccessTotal += interactionSuccess;
        player.SetVar("overallSuccess_total", overallSuccessTotal);
    }
    
    // Calculate average (use totalInteractionCount as denominator)
    const averageOverallSuccess = overallSuccessTotal / totalInteractionCount;
    
    // Cap the average at 1.0
    const cappedAverageOverallSuccess = Math.min(1.0, averageOverallSuccess);
    
    // Store the average
    player.SetVar("overallSuccess", cappedAverageOverallSuccess);
    
    console.log(`overallSuccess: ${cappedAverageOverallSuccess} (${overallSuccessTotal}/${totalInteractionCount}, interactionId: ${currentInteractionId})`);
}

// Main function to process interaction and update all scores
function processInteraction(interaction, userResponse, interactionStage) {
    // Calculate interaction success
    const interactionSuccess = calculateInteractionSuccess(interaction, userResponse, interactionStage);
    
    // Set the interactionSuccess variable in Storyline
    player.SetVar("interactionSuccess", interactionSuccess);
    
    // Store interaction-specific success value for chat history
    const currentInteractionId = player.GetVar("currentInteractionId");
    if (currentInteractionId) {
        player.SetVar(`interactionSuccess_${currentInteractionId}`, interactionSuccess);
    }
    
    // Determine if this is a response stage (final stage of interaction)
    // For one-step: always final stage
    // For end-point: always final stage
    // For two-step: only final stage when interactionStage === "response"
    // For multichoice: always final stage
    const isResponseStage = (interaction.interaction_type === "one-step") || 
                           (interaction.interaction_type === "end-point") ||
                           (interaction.interaction_type === "multichoice") ||
                           (interaction.interaction_type === "two-step" && interactionStage === "response");
    
    // Update character-specific success
    updateCharacterSuccess(interaction, interactionSuccess, isResponseStage);
    
    // Update overall success
    updateOverallSuccess(interactionSuccess, isResponseStage);
    
    // Return results
    return {
        interactionSuccess: interactionSuccess,
        overallSuccess: player.GetVar("overallSuccess"),
        withCharacterSuccess: player.GetVar(`withCharacterSuccess_${interaction.npc.character_id}`)
    };
}

// Function to initialize scoring variables (call this at startup)
function initializeScoringVariables() {
    console.log("=== INITIALIZING SCORING VARIABLES ===");
    
    // Initialize overall tracking - set to correct values regardless of current state
    if (player.GetVar("totalInteractionCount") === undefined || player.GetVar("totalInteractionCount") === 0) {
        player.SetVar("totalInteractionCount", 1); // Start at 1, not 0
    }
    
    if (player.GetVar("overallSuccess_total") === undefined) {
        player.SetVar("overallSuccess_total", 0);
    }

    if (player.GetVar("overallSuccess") === undefined || player.GetVar("overallSuccess") === 0) {
        player.SetVar("overallSuccess", 0); // Start at 0, not 0.5
    }
    
    if (player.GetVar("interactionSuccess") === undefined || player.GetVar("interactionSuccess") === 0) {
        player.SetVar("interactionSuccess", 0); // Start at 0, not 0.5
    }
    
    // Initialize character-specific variables for known characters
    const knownCharacters = ["1", "2", "3", "4"]; // From npc_characters.json
    knownCharacters.forEach(characterId => {
        if (player.GetVar(`withCharacterSuccess_total_${characterId}`) === undefined) {
            player.SetVar(`withCharacterSuccess_total_${characterId}`, 0);
        }

        const currentCharacterSuccess = player.GetVar(`withCharacterSuccess_${characterId}`);
        const currentCharacterCount = player.GetVar(`characterInteractionCount_${characterId}`);
        
        if (currentCharacterSuccess === undefined || currentCharacterSuccess === 0) {
            player.SetVar(`withCharacterSuccess_${characterId}`, 0); // Start at 0, not 0.5
        }
        
        if (currentCharacterCount === undefined || currentCharacterCount === 0) {
            player.SetVar(`characterInteractionCount_${characterId}`, 1);
        }
    });
    
    console.log("Scoring variables initialized");
}

function calculateReordSuccess(interaction, userResponse) {
    const expectations = interaction.expectations;
    const successWeights = interaction.success_weights;
    const attempts = player.GetVar("reordAttempts") || 0;
    const currentInteractionId = player.GetVar("currentInteractionId");
    let multiplier = 1.0;
    if (attempts === 1) {
        multiplier = 0.5;
    } else if (attempts > 1) {
        multiplier = 0;
    }
    const response = (userResponse.reordResponse || "").trim();
    
    // Normalize apostrophes to handle different types of apostrophes
    const normalizedResponse = response.replace(/['''′`]/g, "'").replace(/\u00A0/g, " ").trim();
    
    console.log("=== REORDER DEBUG ===");
    console.log("User response:", `'${response}'`);
    console.log("Normalized response:", `'${normalizedResponse}'`);
    console.log("High expectations:", expectations.high);
    console.log("Medium expectations:", expectations.medium);
    console.log("Low expectations:", expectations.low);
    console.log("Success weights:", successWeights);
    
    let matchType = null;
    let matchIndex = -1;
    let points = 0;
    
    // Check high
    if (Array.isArray(expectations.high)) {
        console.log("Checking high expectations...");
        expectations.high.forEach((exp, idx) => {
            const normalizedExp = exp.replace(/['''′`]/g, "'");
            console.log(`  High[${idx}]: '${exp}' -> normalized: '${normalizedExp}'`);
            console.log(`  Comparing: '${normalizedExp}' === '${normalizedResponse}' = ${normalizedExp === normalizedResponse}`);
            
            // Character-by-character comparison
            if (normalizedExp.length !== normalizedResponse.length) {
                console.log(`  ❌ Length mismatch: expected ${normalizedExp.length}, got ${normalizedResponse.length}`);
            } else {
                for (let i = 0; i < normalizedExp.length; i++) {
                    if (normalizedExp[i] !== normalizedResponse[i]) {
                        console.log(`  ❌ Character mismatch at position ${i}: expected '${normalizedExp[i]}' (${normalizedExp.charCodeAt(i)}), got '${normalizedResponse[i]}' (${normalizedResponse.charCodeAt(i)})`);
                        break;
                    }
                }
            }
        });
        
        matchIndex = expectations.high.findIndex(exp => {
            const normalizedExp = exp.replace(/['''′`]/g, "'");
            return normalizedExp === normalizedResponse;
        });
        console.log("High match index:", matchIndex);
        if (matchIndex !== -1) {
            matchType = "high";
            points = successWeights.high;
            console.log("✅ High match found!");
        }
    } else if (typeof expectations.high === "string") {
        const normalizedExp = expectations.high.replace(/['''′`]/g, "'");
        if (normalizedExp === normalizedResponse) {
            matchType = "high";
            matchIndex = 0;
            points = successWeights.high;
            console.log("✅ High match found (string)!");
        }
    }
    
    // Check medium
    if (!matchType && Array.isArray(expectations.medium)) {
        matchIndex = expectations.medium.findIndex(exp => {
            const normalizedExp = exp.replace(/['''′`]/g, "'");
            return normalizedExp === normalizedResponse;
        });
        console.log("Medium match index:", matchIndex);
        if (matchIndex !== -1) {
            matchType = "medium";
            points = successWeights.medium;
            console.log("✅ Medium match found!");
        }
    }
    
    // Check low
    if (!matchType && Array.isArray(expectations.low)) {
        matchIndex = expectations.low.findIndex(exp => {
            const normalizedExp = exp.replace(/['''′`]/g, "'");
            return normalizedExp === normalizedResponse;
        });
        console.log("Low match index:", matchIndex);
        if (matchIndex !== -1) {
            matchType = "low";
            points = successWeights.low;
            console.log("✅ Low match found!");
        }
    }
    
    // Final score
    const score = points * multiplier;
    console.log(`interactionSuccess: ${score} (reord, interactionId: ${currentInteractionId}, matchType: ${matchType}, matchIndex: ${matchIndex}, points: ${points}, multiplier: ${multiplier}, attempts: ${attempts}, response: '${response}')`);
    console.log("=== END REORDER DEBUG ===");
    
    // Return both score and match information for chat history
    return {
        score: score,
        matchInfo: matchType ? { level: matchType, index: matchIndex } : null
    };
}

// Export functions for use in other modules
window.processInteraction = processInteraction;
window.initializeScoringVariables = initializeScoringVariables;
window.calculateInteractionSuccess = calculateInteractionSuccess; 