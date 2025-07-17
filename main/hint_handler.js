// Hint Handler for generating contextual hints based on rich descriptions

// Function to generate hints for two-step response and one-step interactions
function hintRequest() {
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    const currentStage = player.GetVar("interactionStage");
    
    if (!interaction) {
        console.error(`Interaction ${currentInteractionId} not found`);
        return;
    }
    
    // Only process for two-step response stage and one-step interactions
    const isTwoStepResponse = (interaction.interaction_type === "two-step" && currentStage === "response");
    const isOneStep = (interaction.interaction_type === "one-step");
    const isReorder = (interaction.interaction_type === "reord");
    
    if (!isTwoStepResponse && !isOneStep && !isReorder) {
        console.log("Hint not available for this interaction type/stage");
        return;
    }
    
    // Handle reorder interactions - use the hint from the interaction data
    if (isReorder) {
        if (interaction.hint) {
            player.SetVar("currentHint", interaction.hint);
            console.log("Generated reorder hint:", interaction.hint);
        } else {
            console.log("No hint found for reorder interaction");
        }
        return;
    }
    
    const npcName = interaction.npc.character_name;
    const expectations = interaction.expectations;
    const successWeights = interaction.success_weights;
    const richDescriptions = window.EN_richDescriptions;
    
    let hintParts = [];
    
    // Check topic expectations
    if (successWeights.topic > 0 && expectations.topic !== "neutral") {
        const topicDesc = richDescriptions.topics[expectations.topic];
        if (topicDesc) {
            hintParts.push(topicDesc.expectation_description);
        }
    }
    
    // Check function expectations
    if (successWeights.function > 0) {
        const functionDescriptions = [];
        if (Array.isArray(expectations.function)) {
            expectations.function.forEach(func => {
                if (func !== "" && richDescriptions.functions[func]) {
                    functionDescriptions.push(richDescriptions.functions[func].description);
                }
            });
        } else if (expectations.function !== "" && richDescriptions.functions[expectations.function]) {
            functionDescriptions.push(richDescriptions.functions[expectations.function].description);
        }
        
        if (functionDescriptions.length > 0) {
            hintParts.push(functionDescriptions.join(" / "));
        }
    }
    
    // Check tone expectations
    if (successWeights.tone > 0) {
        const toneDescriptions = [];
        if (Array.isArray(expectations.tone)) {
            expectations.tone.forEach(tone => {
                if (tone !== "" && tone !== "neutral" && richDescriptions.tones[tone]) {
                    toneDescriptions.push(richDescriptions.tones[tone].description);
                }
            });
        } else if (expectations.tone !== "" && expectations.tone !== "neutral" && richDescriptions.tones[expectations.tone]) {
            toneDescriptions.push(richDescriptions.tones[expectations.tone].description);
        }
        
        if (toneDescriptions.length > 0) {
            hintParts.push(toneDescriptions.join(" / "));
        }
    }
    
    // Check formality expectations
    if (successWeights.formality > 0) {
        if (expectations.formality && Array.isArray(expectations.formality)) {
            expectations.formality.forEach(formality => {
                if (formality !== "" && formality !== "neutral" && richDescriptions.formality[formality]) {
                    hintParts.push(richDescriptions.formality[formality].description);
                }
            });
        } else if (expectations.formality && expectations.formality !== "" && expectations.formality !== "neutral" && richDescriptions.formality[expectations.formality]) {
            hintParts.push(richDescriptions.formality[expectations.formality].description);
        }
    }
    
    // Build the hint text
    let hintText = `<strong>${npcName} expects you:</strong>`;
    
    if (hintParts.length > 0) {
        hintText += "<br><br>" + hintParts.map(part => `• ${part}`).join("<br>");
    } else {
        hintText += "<br><br>• No specific expectations found";
    }
    
    // Set the hint in Storyline
    player.SetVar("currentHint", hintText);
    
    console.log("Generated hint:", hintText);
}

// Export function for use in other modules
window.hintRequest = hintRequest;
