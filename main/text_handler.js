// Use the globally available player
// const player = window.player;  // Remove this line - window.player is already available

// Function to shuffle array keeping last item in place
function shuffleArray(array) {
    // If array has 5 or more items, only shuffle first 4
    if (array.length >= 5) {
        const lastItem = array.pop(); // Remove and store last item
        // Shuffle first 4 items
        for (let i = 3; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        array.push(lastItem); // Add last item back
    } else {
        // If less than 5 items, shuffle all except last
        for (let i = array.length - 2; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    return array;
}

// Function to shuffle all items in array
function shuffleAll(array) {
    console.log("shuffleAll called with array length:", array.length);
    // Shuffle all items
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        console.log(`Shuffle step ${array.length - i}: swapping index ${i} with index ${j}`);
        [array[i], array[j]] = [array[j], array[i]];
    }
    console.log("shuffleAll completed, returning:", array);
    return array;
}

function getNpcTextForFeedback(newInteraction, prevResponseId) {
    let feedbackText = "";
    if (newInteraction.npc && Array.isArray(newInteraction.npc.feedback) && prevResponseId !== undefined && prevResponseId !== null) {
        // Find feedback by id (if feedback objects have an id), else by zero-based index
        const feedbackObj = newInteraction.npc.feedback.find((f, idx) => (f.id !== undefined ? f.id == prevResponseId : idx == prevResponseId));
        feedbackText = feedbackObj && feedbackObj.text ? feedbackObj.text : "";
    }
    const promptText = newInteraction.npc?.new_prompt?.text || "";
    if (feedbackText && promptText) return `${feedbackText}\n${promptText}`;
    if (feedbackText) return feedbackText;
    if (promptText) return promptText;
    return null;
}

// Function to initialize TTS state variables
function initializeTTSState() {
    console.log("=== INITIALIZING TTS STATE VARIABLES ===");
    
    // Initialize isSpeechPlaying to "no" if not already set
    if (player.GetVar("isSpeechPlaying") === undefined) {
        player.SetVar("isSpeechPlaying", "no");
        console.log("Set isSpeechPlaying to: no");
    } else {
        console.log("isSpeechPlaying already set to:", player.GetVar("isSpeechPlaying"));
    }
    
    // Initialize other TTS-related variables if needed
    if (player.GetVar("ttsEnabled") === undefined) {
        player.SetVar("ttsEnabled", "yes");
        console.log("Set ttsEnabled to: yes");
    }
    
    console.log("TTS state variables initialized");
}

// Function to initialize options in Storyline
function initializeOptions() {
    console.log("=== initializeOptions CALLED ===");
    console.log("Current interaction ID:", player.GetVar("currentInteractionId"));
    console.log("Interaction data available:", !!window.interactionData);
    
    // Initialize TTS state variables first
    initializeTTSState();
    
    // Clear interactionStage to ensure clean slate for new interaction
    player.SetVar("interactionStage", "");
    
    // Initialize interactionSuccess to 0 for new interaction
    player.SetVar("interactionSuccess", 0);

    // Initialize attempt counters for the new interaction
    player.SetVar("understandingAttempts", 0);
    player.SetVar("responseAttempts", 0);
    player.SetVar("reordAttempts", 0);

    // Clear reordResponse for reorder interactions (now interaction-specific)
    const currentInteractionId = player.GetVar("currentInteractionId");
    if (currentInteractionId) {
        player.SetVar(`reordResponse_${currentInteractionId}`, "");
    }
    
    
    const numericId = Number(currentInteractionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    
    if (!interaction) {
        console.error(`Interaction ${currentInteractionId} not found`);
        return;
    }

    console.log("Found interaction:", interaction.interaction_id, interaction.interaction_type);

    // Dialogue interaction: set type and stop
    if (interaction.interaction_type === "dialogue") {
        player.SetVar("interactionType", "dialogue");
        console.log("Dialogue interaction - setting type only");
        return;
    }

    // Feedback+prompt logic for one-step and two-step response interactions
    let npcTextSet = false;
    if (interaction.npc && interaction.npc.feedback) {
        const prevResponseId = player.GetVar(`lastResponse_${numericId - 1}`);
        const feedbackPrompt = getNpcTextForFeedback(interaction, prevResponseId);
        if (feedbackPrompt !== null) {
            player.SetVar("npcText", feedbackPrompt);
            npcTextSet = true;
            console.log("Set npcText from feedback:", feedbackPrompt);
        }
    }
    if (!npcTextSet) {
        // Default: Display NPC text
        player.SetVar("npcText", interaction.npc.text);
        console.log("Set npcText from default:", interaction.npc.text);
    }
    
    // Store NPC text for chat history
    const npcTextToStore = player.GetVar("npcText");
    player.SetVar(`npcText_${currentInteractionId}`, npcTextToStore);
    
    player.SetVar("npcName", interaction.npc.character_name);
    player.SetVar("interactionType", interaction.interaction_type);
    
    console.log("NPC name set to:", interaction.npc.character_name);
    console.log("Interaction type set to:", interaction.interaction_type);
    
    // Check interaction type and handle accordingly
    if (interaction.interaction_type === "one-step") {
        // For one-step interactions, go directly to detailed responses
        console.log("Handling one-step interaction");
        handleOneStepInteraction(interaction);
    } else if (interaction.interaction_type === "end-point") {
        // For end-point interactions, handle like one-step but with single button
        console.log("Handling end-point interaction");
        handleEndPointInteraction(interaction);
    } else if (interaction.interaction_type === "reord") {
        // For reorder interactions
        console.log("Handling reord interaction");
        handleReordInteraction(interaction);
    } else if (interaction.interaction_type === "multichoice") {
        // For multichoice interactions
        console.log("Handling multichoice interaction");
        handleMultichoiceInteraction(interaction);
    } else {
        // For two-step interactions (default), use understanding check first
        console.log("Handling two-step interaction");
        handleTwoStepInteraction(interaction);
    }
    
    console.log("=== initializeOptions COMPLETED ===");
    
    // NOTE: NPC TTS is now handled when interactionStage changes, not here
    // This prevents double TTS calls when currentInteractionId and interactionStage both change
}

// Function to handle one-step interactions
function handleOneStepInteraction(interaction) {
    // Get all detailed responses
    const detailedResponses = interaction.detailed_responses;
    
    // Shuffle the responses
    const shuffledResponses = shuffleArray([...detailedResponses]);
    
    // Set individual button variables - text, data, and audio
    shuffledResponses.forEach((option, index) => {
        // Replace {characterName} placeholder with actual NPC name for repeat requests
        let buttonText = option.text;
        if (option.function === "ask_repeat" && buttonText.includes("{characterName}")) {
            const npcName = interaction.npc.character_name;
            buttonText = buttonText.replace(/{characterName}/g, npcName);
        }
        player.SetVar(`button_text_${index + 1}`, buttonText);
        player.SetVar(`button_data_${index + 1}`, JSON.stringify(option));
        player.SetVar(`button_audio_${index + 1}`, option.audio_button !== undefined ? option.audio_button : option.audio);
    });
    
    // Set total count for buttons based on detailed responses length
    player.SetVar("buttonCount", shuffledResponses.length);

    // Clear any remaining button variables
    for (let i = shuffledResponses.length + 1; i <= 5; i++) {
        player.SetVar(`button_text_${i}`, "");
        player.SetVar(`button_data_${i}`, "");
        player.SetVar(`button_audio_${i}`, "");
    }

    // Set interaction stage to response (direct response, no understanding check)
    player.SetVar("interactionStage", "response");
}

// Function to handle end-point interactions
function handleEndPointInteraction(interaction) {
    // Get the single detailed response
    const detailedResponses = interaction.detailed_responses;
    
    if (detailedResponses && detailedResponses.length > 0) {
        const response = detailedResponses[0]; // Only one response for end-point
        
        // Set the single button variables
        player.SetVar(`button_text_1`, response.text);
        player.SetVar(`button_data_1`, JSON.stringify(response));
        player.SetVar(`button_audio_1`, response.audio_button !== undefined ? response.audio_button : response.audio);
        
        // Set button count to 1
        player.SetVar("buttonCount", 1);
        
        // Clear any remaining button variables
        for (let i = 2; i <= 5; i++) {
            player.SetVar(`button_text_${i}`, "");
            player.SetVar(`button_data_${i}`, "");
            player.SetVar(`button_audio_${i}`, "");
        }
    } else {
        console.error("No detailed responses found for end-point interaction");
        player.SetVar("buttonCount", 0);
    }

    // Set interaction stage to response
    player.SetVar("interactionStage", "response");
}

// Function to handle two-step interactions
function handleTwoStepInteraction(interaction) {
    // Get understanding check options
    const understandingOptions = interaction.understanding_check;
    
    // Shuffle understanding options except last item
    const shuffledUnderstandingOptions = shuffleArray([...understandingOptions]);
    
    // Set individual button variables - text, data, and audio
    shuffledUnderstandingOptions.forEach((option, index) => {
        player.SetVar(`button_text_${index + 1}`, option.text);
        player.SetVar(`button_data_${index + 1}`, JSON.stringify(option));
        player.SetVar(`button_audio_${index + 1}`, option.audio_button !== undefined ? option.audio_button : option.audio);
    });
    
    // Set total count for buttons based on understanding options length
    player.SetVar("buttonCount", shuffledUnderstandingOptions.length);

    // Clear any remaining button variables
    for (let i = shuffledUnderstandingOptions.length + 1; i <= 5; i++) {
        player.SetVar(`button_text_${i}`, "");
        player.SetVar(`button_data_${i}`, "");
        player.SetVar(`button_audio_${i}`, "");
    }

    // Set interaction stage to understanding
    player.SetVar("interactionStage", "understanding");
}

// Function to handle reorder interactions
function handleReordInteraction(interaction) {
    const segments = interaction.reord_segments || [];
    const shuffledSegments = shuffleAll([...segments]); // Use shuffleAll for reord to shuffle ALL items
    // Set button_text_i variables, replacing \u00A0 with a regular space
    shuffledSegments.forEach((segment, index) => {
        const displayText = segment.text.replace(/\u00A0/g, " ");
        player.SetVar(`button_text_${index + 1}`, displayText);
    });
    // Clear any remaining button variables
    for (let i = shuffledSegments.length + 1; i <= 8; i++) {
        player.SetVar(`button_text_${i}`, "");
    }
    // Set interaction stage to reord
    player.SetVar("interactionStage", "reord");
    player.SetVar("buttonCount", shuffledSegments.length);
}

// Function to handle multichoice interactions
function handleMultichoiceInteraction(interaction) {
    // Check if this interaction should use content based on previous choice
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    
    // Check if there's a previous interaction that set a lastResponse for content selection
    let contentSelector = null;
    let options = interaction.multi_choice_option || [];
    
    // Check for content selection based on previous interaction choices
    if (interaction.content_selection) {
        const previousResponse = player.GetVar(`lastResponse_${interaction.content_selection.from_interaction}`);
        if (previousResponse !== undefined && previousResponse !== null) {
            contentSelector = previousResponse;
            console.log(`Content selector found: ${contentSelector} from interaction ${interaction.content_selection.from_interaction}`);
        }
    }
    
    // If we have a content selector, use the appropriate content set
    if (contentSelector !== null && interaction.content_sets && interaction.content_sets[contentSelector]) {
        const selectedContent = interaction.content_sets[contentSelector];
        options = selectedContent.multi_choice_option || [];
        
        // Use the selected content's column headers if available
        if (selectedContent.column_headers) {
            player.SetVar("column_header_1", selectedContent.column_headers.text_1);
            player.SetVar("column_header_2", selectedContent.column_headers.text_2);
        }
        
        // Use the selected content's expectations if available
        if (selectedContent.expectations) {
            player.SetVar("multichoice_high_min", selectedContent.expectations.high.min);
            player.SetVar("multichoice_high_max", selectedContent.expectations.high.max);
            player.SetVar("multichoice_medium_min", selectedContent.expectations.medium.min);
            player.SetVar("multichoice_medium_max", selectedContent.expectations.medium.max);
            player.SetVar("multichoice_low_min", selectedContent.expectations.low.min);
            player.SetVar("multichoice_low_max", selectedContent.expectations.low.max);
        }
    } else {
        // Use default content
        if (interaction.column_headers) {
            player.SetVar("column_header_1", interaction.column_headers.text_1);
            player.SetVar("column_header_2", interaction.column_headers.text_2);
        }
        
        // Use default expectations
        if (interaction.expectations) {
            player.SetVar("multichoice_high_min", interaction.expectations.high.min);
            player.SetVar("multichoice_high_max", interaction.expectations.high.max);
            player.SetVar("multichoice_medium_min", interaction.expectations.medium.min);
            player.SetVar("multichoice_medium_max", interaction.expectations.medium.max);
            player.SetVar("multichoice_low_min", interaction.expectations.low.min);
            player.SetVar("multichoice_low_max", interaction.expectations.low.max);
        }
    }
    
    // Shuffle all options including the last one
    console.log("Multichoice shuffling debug - Original options:", options);
    const shuffledOptions = shuffleAll([...options]);
    console.log("Multichoice shuffling debug - Shuffled options:", shuffledOptions);
    
    // Set individual option text variables and data
    shuffledOptions.forEach((option, index) => {
        player.SetVar(`button_text_${index + 1}`, option.text);
        player.SetVar(`button_data_${index + 1}`, JSON.stringify(option));
    });
    
    // Set button count based on options length
    player.SetVar("buttonCount", shuffledOptions.length);
    
    // Clear any remaining button variables
    for (let i = shuffledOptions.length + 1; i <= 6; i++) {
        player.SetVar(`button_text_${i}`, "");
    }
    
    // Initialize selection variables
    for (let i = 1; i <= shuffledOptions.length; i++) {
        player.SetVar(`selectedMultiChoiceIndex_${i}`, "");
    }
    
    // Set interaction stage to multichoice
    player.SetVar("interactionStage", "multichoice");
}

// Function to process user response
function processUserResponse() {
    const currentInteractionId = player.GetVar("currentInteractionId");
    const selectedButtonIndex = player.GetVar("selectedButtonIndex");
    const responseObj = JSON.parse(player.GetVar(`button_data_${selectedButtonIndex}`) || '{}');
    const numericId = Number(currentInteractionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    
    if (!interaction) {
        console.error(`Current interaction not found`);
        return;
    }

    // Check interaction type and handle accordingly
    if (interaction.interaction_type === "one-step") {
        // For one-step interactions, process the response directly
        processOneStepResponse(interaction, responseObj, selectedButtonIndex);
    } else if (interaction.interaction_type === "end-point") {
        // For end-point interactions, process like one-step
        processOneStepResponse(interaction, responseObj, selectedButtonIndex);
    } else if (interaction.interaction_type === "reord") {
        // For reorder interactions
        const currentStage = player.GetVar("interactionStage");
        if (currentStage === "reord") {
            processReordResponse(interaction);
        }
    } else if (interaction.interaction_type === "multichoice") {
        // For multichoice interactions - this will be handled by processMultiChoiceResponse
        // when user clicks submit, not when individual buttons are clicked
        console.log("Multichoice interaction - individual button clicks handled separately");
    } else {
        // For two-step interactions, check if we're in understanding stage
        const currentStage = player.GetVar("interactionStage");
        if (currentStage === "understanding") {
            // Always process the understanding response (right or wrong)
            processUnderstandingResponse(interaction, responseObj);
            // Check if the response function matches any expected function
            if (interaction.expectations.function.includes(responseObj.function)) {
                // Move to response stage with detailed responses
                handleTwoStepResponse(interaction, responseObj);
            } else {
                // Wrong response - increment attempt counter and stay in understanding stage
                let attempts = player.GetVar("understandingAttempts") || 0;
                player.SetVar("understandingAttempts", attempts + 1);
                console.log(`Wrong understanding response. Attempts: ${attempts + 1}`);
            }
        } else {
            // Already in response stage, process the final response
            processTwoStepFinalResponse(interaction, responseObj, selectedButtonIndex);
        }
    }
}

// Function to process understanding response (right or wrong)
function processUnderstandingResponse(interaction, responseObj) {
    // Process the understanding check response for scoring
    const understandingResult = processInteraction(interaction, responseObj, "understanding");
    
    // Update Storyline variables with understanding stage scoring
    player.SetVar("interactionSuccess", understandingResult.interactionSuccess);
    player.SetVar("overallSuccess", understandingResult.overallSuccess);
    player.SetVar(`withCharacterSuccess_${interaction.npc.character_id}`, understandingResult.withCharacterSuccess);
    
    console.log("Understanding response processed - interactionSuccess:", understandingResult.interactionSuccess);
}

// Function to process one-step response (final response)
function processOneStepResponse(interaction, responseObj, selectedButtonIndex) {
    // Process the response using the scoring system
    const result = processInteraction(interaction, responseObj, "response");
    
    // Update Storyline variables with new scoring system
    player.SetVar("interactionSuccess", result.interactionSuccess);
    player.SetVar("overallSuccess", result.overallSuccess);
    player.SetVar(`withCharacterSuccess_${interaction.npc.character_id}`, result.withCharacterSuccess);

    // Get currentInteractionId early since we need it for both operations
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    const currentStage = player.GetVar("interactionStage");

    // Check and apply endpoint navigation rules FIRST
    console.log("=== processOneStepResponse Debug ===");
    console.log("Calling checkAndApplyEndpointRules with:");
    console.log("  numericId:", numericId);
    console.log("  responseObj:", responseObj);
    console.log("  interactionType: one-step");
    console.log("  currentStage:", currentStage);
    console.log("  interaction:", interaction);
    checkAndApplyEndpointRules(numericId, responseObj, "one-step", currentStage, interaction, true);

    // Store the actual user response for chat history
    if (interaction.interaction_type === "end-point") {
        player.SetVar(`endPointResponse_${currentInteractionId}`, JSON.stringify(responseObj));
    } else {
        player.SetVar(`MCQResponse_${currentInteractionId}`, JSON.stringify(responseObj));
    }

    // Only trigger TTS if audio is enabled, and wait for completion before updating lastResponse
    // BUT: Skip all state updates for repeat requests
    if (responseObj.function === "ask_repeat") {
        console.log("Repeat request detected - skipping lastResponse and endpoint navigation updates");
        // Only trigger TTS, no state changes
        if (responseObj.audio === "yes") {
            window.handleUserTTSRequest(selectedButtonIndex);
        }
        return; // Exit early, no state changes
    }
    
    if (responseObj.audio === "yes") {
        const ttsPromise = window.handleUserTTSRequest(selectedButtonIndex);
        ttsPromise.then(() => {
            // Update lastResponse_i only after user TTS completes
            const selectedResponseId = responseObj.id;
            if (selectedResponseId !== undefined && selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
            // The first call above already handles endpoint navigation with waitForTTS: true
        }).catch((error) => {
            console.error("Error in user TTS, but still updating lastResponse:", error);
            // Still update lastResponse even if TTS fails
            const selectedResponseId = responseObj.id;
            if (selectedResponseId !== undefined && selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
        });
    } else {
        // No TTS, update lastResponse immediately and check endpoint navigation
        const selectedResponseId = responseObj.id;
        if (selectedResponseId !== undefined && selectedResponseId !== null) {
            player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
        }
        // Mark interaction as visited
        if (window.markInteractionAsVisited) {
            window.markInteractionAsVisited(currentInteractionId);
        }
        // Check endpoint navigation rules immediately
        checkAndApplyEndpointRules(numericId, responseObj, "one-step", currentStage, interaction, false);
    }
}

// Function to handle two-step response (understanding to response transition)
function handleTwoStepResponse(interaction, responseObj) {
    // Scoring has already been done in processUnderstandingResponse, so we don't need to call processInteraction again
    
    // Check if this interaction should use content based on previous choice
    let contentSelector = null;
    let detailedResponses = interaction.detailed_responses || [];

    // Check for content selection based on previous interaction choices
    if (interaction.content_selection) {
        const fromInteractions = Array.isArray(interaction.content_selection.from_interaction) 
            ? interaction.content_selection.from_interaction 
            : [interaction.content_selection.from_interaction];
        
        // Check each possible source interaction
        for (const fromInteraction of fromInteractions) {
            const previousResponse = player.GetVar(`lastResponse_${fromInteraction}`);
            if (previousResponse !== undefined && previousResponse !== null) {
                contentSelector = previousResponse;
                console.log(`Content selector found: ${contentSelector} from interaction ${fromInteraction}`);
                break; // Use the first valid response found
            }
        }
    }
    
    // If we have a content selector, use the appropriate content set
    if (contentSelector !== null && interaction.content_sets && interaction.content_sets[contentSelector]) {
        const selectedContent = interaction.content_sets[contentSelector];
        detailedResponses = selectedContent.detailed_responses || [];
        console.log(`Using content set ${contentSelector} for interaction ${interaction.interaction_id}`);
    } else {
        console.log(`Using default content for interaction ${interaction.interaction_id}`);
    }

    // Shuffle ALL the responses
    const shuffledResponses = shuffleAll([...detailedResponses]);

    // Update the same button variables with detailed responses
    shuffledResponses.forEach((option, index) => {
        // Replace {characterName} placeholder with actual NPC name for repeat requests
        let buttonText = option.text;
        if (option.function === "ask_repeat" && buttonText.includes("{characterName}")) {
            const npcName = interaction.npc.character_name;
            buttonText = buttonText.replace(/{characterName}/g, npcName);
        }
        player.SetVar(`button_text_${index + 1}`, buttonText);
        player.SetVar(`button_data_${index + 1}`, JSON.stringify(option));
        player.SetVar(`button_audio_${index + 1}`, option.audio_button !== undefined ? option.audio_button : option.audio);
    });

    // Set the count of available buttons
    player.SetVar("buttonCount", shuffledResponses.length);

    // Clear any remaining button variables
    for (let i = shuffledResponses.length + 1; i <= 5; i++) {
        player.SetVar(`button_text_${i}`, "");
        player.SetVar(`button_data_${i}`, "");
        player.SetVar(`button_audio_${i}`, "");
    }
    
    // Set interaction stage to response AFTER button_audio_x is set
    player.SetVar("interactionStage", "response");
}

// Function to process two-step final response
function processTwoStepFinalResponse(interaction, responseObj, selectedButtonIndex) {
    // Process the response using the scoring system
    const result = processInteraction(interaction, responseObj, "response");
    
    // Update Storyline variables with new scoring system
    player.SetVar("interactionSuccess", result.interactionSuccess);
    player.SetVar("overallSuccess", result.overallSuccess);
    player.SetVar(`withCharacterSuccess_${interaction.npc.character_id}`, result.withCharacterSuccess);

    // Get currentInteractionId early since we need it for both operations
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    const currentStage = player.GetVar("interactionStage");

    // Check and apply endpoint navigation rules FIRST
    console.log("=== processTwoStepFinalResponse Debug ===");
    console.log("Calling checkAndApplyEndpointRules with:");
    console.log("  numericId:", numericId);
    console.log("  responseObj:", responseObj);
    console.log("  interactionType: two-step");
    console.log("  currentStage:", currentStage);
    console.log("  interaction:", interaction);
    checkAndApplyEndpointRules(numericId, responseObj, "two-step", currentStage, interaction, true);

    // Store the actual user response for chat history
    player.SetVar(`MCQResponse_${currentInteractionId}`, JSON.stringify(responseObj));

    // Only trigger TTS if audio is enabled, and wait for completion before updating lastResponse
    // BUT: Skip all state updates for repeat requests
    if (responseObj.function === "ask_repeat") {
        console.log("Repeat request detected - skipping lastResponse and endpoint navigation updates");
        // Only trigger TTS, no state changes
        if (responseObj.audio === "yes") {
            window.handleUserTTSRequest(selectedButtonIndex);
        }
        return; // Exit early, no state changes
    }
    
    if (responseObj.audio === "yes") {
        const ttsPromise = window.handleUserTTSRequest(selectedButtonIndex);
        ttsPromise.then(() => {
            // Update lastResponse_i only after user TTS completes
            const selectedResponseId = responseObj.id;
            if (selectedResponseId !== undefined && selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
            // The first call above already handles endpoint navigation with waitForTTS: true
        }).catch((error) => {
            console.error("Error in user TTS, but still updating lastResponse:", error);
            // Still update lastResponse even if TTS fails
            const selectedResponseId = responseObj.id;
            if (selectedResponseId !== undefined && selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
        });
    } else {
        // No TTS, update lastResponse immediately and check endpoint navigation
        const selectedResponseId = responseObj.id;
        if (selectedResponseId !== undefined && selectedResponseId !== null) {
            player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
        }
        // Mark interaction as visited
        if (window.markInteractionAsVisited) {
            window.markInteractionAsVisited(currentInteractionId);
        }
        // Check endpoint navigation rules immediately
        checkAndApplyEndpointRules(numericId, responseObj, "two-step", currentStage, interaction, false);
    }
}

// Function to process reorder response
function processReordResponse(interaction) {
    // Get the user's reordered sentence from interaction-specific variable
    const currentInteractionId = player.GetVar("currentInteractionId");
    const reordResponse = player.GetVar(`reordResponse_${currentInteractionId}`) || "";
    // Process the reorder response using the scoring system
    const result = processInteraction(interaction, { reordResponse }, "reord");
    // Update Storyline variables with new scoring system
    player.SetVar("interactionSuccess", result.interactionSuccess);
    player.SetVar("overallSuccess", result.overallSuccess);
    player.SetVar(`withCharacterSuccess_${interaction.npc.character_id}`, result.withCharacterSuccess);
    
    // Store the selected response id for feedback in next interaction
    // For reorder, we need to determine which expectation level was matched
    const response = reordResponse.trim();
    const expectations = interaction.expectations;
    
    // Determine which expectation level was matched
    let selectedResponseId = null;
    
    // Check high expectations
    if (Array.isArray(expectations.high) && expectations.high.includes(response)) {
        selectedResponseId = 0; // high = 0
    } else if (typeof expectations.high === "string" && expectations.high === response) {
        selectedResponseId = 0; // high = 0
    }
    // Check medium expectations
    else if (Array.isArray(expectations.medium) && expectations.medium.includes(response)) {
        selectedResponseId = 1; // medium = 1
    }
    // Check low expectations
    else if (Array.isArray(expectations.low) && expectations.low.includes(response)) {
        selectedResponseId = 2; // low = 2
    }
    
    // Check and apply endpoint navigation rules FIRST (sets GoToEndPoint and lastResponse_9)
    const numericId = Number(currentInteractionId);
    const currentStage = player.GetVar("interactionStage");
    checkAndApplyEndpointRules(numericId, { reordResponse }, "reord", currentStage, interaction, true);
    
    // Increment reordAttempts if not a perfect match
    if (result.interactionSuccess < (interaction.success_weights.high || 1)) {
        let attempts = player.GetVar("reordAttempts") || 0;
        player.SetVar("reordAttempts", attempts + 1);
    }

    // Handle TTS and update lastResponse after completion
    if (result.interactionSuccess > 0) {
        const text = player.GetVar(`reordResponse_${currentInteractionId}`);
        const ttsPromise = window.handleReordTTSRequest(text);
        ttsPromise.then(() => {
            // Update lastResponse_i only after user TTS completes
            if (selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
            // The first call above already handles endpoint navigation with waitForTTS: true
        }).catch((error) => {
            console.error("Error in reorder TTS, but still updating lastResponse:", error);
            // Still update lastResponse even if TTS fails
            if (selectedResponseId !== null) {
                player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
            }
            // Mark interaction as visited
            if (window.markInteractionAsVisited) {
                window.markInteractionAsVisited(currentInteractionId);
            }
            // REMOVED: Second call to checkAndApplyEndpointRules - this was causing the issue
        });
    } else {
        // No TTS, update lastResponse immediately and check endpoint navigation
        if (selectedResponseId !== null) {
            player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
        }
        // Mark interaction as visited
        if (window.markInteractionAsVisited) {
            window.markInteractionAsVisited(currentInteractionId);
        }
        // Check endpoint navigation rules immediately
        checkAndApplyEndpointRules(numericId, { reordResponse }, "reord", currentStage, interaction, false);
    }
}

// Function to build reordResponse from responseSegment_1 to responseSegment_8, then call processUserResponse
function buildReordResponseAndSubmit() {
    let response = "";
    for (let i = 1; i <= 8; i++) {
        let segment = player.GetVar(`responseSegment_${i}`) || "";
        response += segment;
    }
    // Store the response with interaction-specific variable name
    const currentInteractionId = player.GetVar("currentInteractionId");
    player.SetVar(`reordResponse_${currentInteractionId}`, response);
    processUserResponse();
}

// Function to process multichoice response
function processMultiChoiceResponse() {
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    
    if (!interaction) {
        console.error(`Interaction ${currentInteractionId} not found`);
        return;
    }
    
    if (interaction.interaction_type !== "multichoice") {
        console.error("processMultiChoiceResponse called for non-multichoice interaction");
        return;
    }
    
    const buttonCount = player.GetVar("buttonCount");
    
    // Get the correct options based on content selection (same logic as handleMultichoiceInteraction)
    let options = interaction.multi_choice_option || [];
    
    // Check if there's a previous interaction that set a lastResponse for content selection
    if (interaction.content_selection) {
        const previousResponse = player.GetVar(`lastResponse_${interaction.content_selection.from_interaction}`);
        if (previousResponse !== undefined && previousResponse !== null) {
            const contentSelector = previousResponse;
            console.log(`Content selector found: ${contentSelector} from interaction ${interaction.content_selection.from_interaction}`);
            
            // If we have a content selector, use the appropriate content set
            if (interaction.content_sets && interaction.content_sets[contentSelector]) {
                const selectedContent = interaction.content_sets[contentSelector];
                options = selectedContent.multi_choice_option || [];
            }
        }
    }
    
    let correctCount = 0;
    
    // Compare user selections with expected responses
    for (let i = 1; i <= buttonCount; i++) {
        const userSelection = player.GetVar(`selectedMultiChoiceIndex_${i}`);
        const expectedResponse = options[i - 1].expected_response;
        const optionText = options[i - 1].text;
        
        // Console log for debugging
        console.log(`${optionText}, ${expectedResponse} => ${userSelection}`);
        
        if (userSelection === expectedResponse) {
            correctCount++;
        }
    }
    
    // Store the correct count
    player.SetVar("multiChoiceCorrectCount", correctCount);
    
    // Determine success level based on dynamic expectations (set during content selection)
    let successLevel = "low";
    
    const highMin = player.GetVar("multichoice_high_min");
    const highMax = player.GetVar("multichoice_high_max");
    const mediumMin = player.GetVar("multichoice_medium_min");
    const mediumMax = player.GetVar("multichoice_medium_max");
    const lowMin = player.GetVar("multichoice_low_min");
    const lowMax = player.GetVar("multichoice_low_max");
    
    if (highMin !== undefined && highMax !== undefined && correctCount >= highMin && correctCount <= highMax) {
        successLevel = "high";
    } else if (mediumMin !== undefined && mediumMax !== undefined && correctCount >= mediumMin && correctCount <= mediumMax) {
        successLevel = "medium";
    } else if (lowMin !== undefined && lowMax !== undefined && correctCount >= lowMin && correctCount <= lowMax) {
        successLevel = "low";
    }
    
    // Calculate success score based on weights
    const successWeights = interaction.success_weights;
    const successScore = successWeights[successLevel] || 0;
    
    // Use the proper scoring system instead of directly setting variables
    const result = window.processInteraction(interaction, { successScore, successLevel, correctCount }, "multichoice");
    
    console.log(`Multichoice results: ${correctCount}/${buttonCount} correct, success level: ${successLevel}, score: ${successScore}`);
    
    // Store the selected response id for feedback in next interaction
    // For multichoice, we store which content set was chosen (0=Guacamole, 1=Stuffed mushrooms, etc.)
    let selectedResponseId = null;
    
    // Get the content set that was chosen for this interaction
    if (interaction.content_selection) {
        const previousResponse = player.GetVar(`lastResponse_${interaction.content_selection.from_interaction}`);
        if (previousResponse !== undefined && previousResponse !== null) {
            selectedResponseId = previousResponse; // Use the content set ID (0, 1, etc.)
        }
    }
    
    // Store the response ID immediately (no TTS waiting for multichoice)
    if (selectedResponseId !== null) {
        player.SetVar(`lastResponse_${currentInteractionId}`, selectedResponseId);
    }
    
    // Mark interaction as visited
    if (window.markInteractionAsVisited) {
        window.markInteractionAsVisited(currentInteractionId);
    }
    
    // Store the actual user choices for chat history and feedback construction
    // Create a JSON string with all the user selections and option texts
    const userChoices = [];
    
    // Collect user selections using the stored button data
    for (let i = 1; i <= buttonCount; i++) {
        const userSelection = player.GetVar(`selectedMultiChoiceIndex_${i}`);
        const optionData = JSON.parse(player.GetVar(`button_data_${i}`) || '{}');
        
        userChoices.push({
            option: optionData.text,
            selection: userSelection
        });
    }
    
    // Store as JSON string for chat history reconstruction
    player.SetVar(`multichoiceResponse_${currentInteractionId}`, JSON.stringify(userChoices));
    
    // Check and apply endpoint navigation rules for multichoice interactions
    // Since multichoice has no user TTS, we can set GoToEndPoint immediately
    const currentStage = player.GetVar("interactionStage");
    console.log("=== processMultiChoiceResponse Debug ===");
    console.log("Calling checkAndApplyEndpointRules for multichoice with:");
    console.log("  numericId:", numericId);
    console.log("  responseObj:", { successScore, successLevel, correctCount });
    console.log("  interactionType: multichoice");
    console.log("  currentStage:", currentStage);
    console.log("  interaction:", interaction);
    checkAndApplyEndpointRules(numericId, { successScore, successLevel, correctCount }, "multichoice", currentStage, interaction, false);
}

// Function to construct dynamic feedback based on JSON configuration
function constructFeedbackFromConfig(dialogueInteraction, feedbackConfig) {
    try {
        console.log("constructFeedbackFromConfig called for dialogue interaction:", dialogueInteraction.interaction_id);
        
        // Check if feedback configuration is provided
        if (!feedbackConfig) {
            console.error("No feedback configuration provided");
            return null;
        }
        
        const config = feedbackConfig;
        const sourceInteractionId = config.source_interaction;
        const template = config.template;
        const logic = config.logic;
        
        console.log("Feedback construction config:", config);
        
        // Handle dynamic line selection case
        if (logic.selection_type === "dynamic_line_selection") {
            console.log("=== DYNAMIC LINE SELECTION DEBUG ===");
            const dialogueTurn = Number(player.GetVar("dialogueTurn"));
            console.log("dialogueTurn:", dialogueTurn);
            console.log("dialogueInteraction ID:", dialogueInteraction.interaction_id);
            
            const variantKey = selectDynamicLine(dialogueInteraction, dialogueTurn);
            console.log("Dynamic line selection variant:", variantKey);
            
            if (variantKey) {
                // Get the line that contains the dynamic variants
                const lineKey = `line_${dialogueTurn}`;
                const line = dialogueInteraction[lineKey];
                
                if (line && line.dynamic_variants && line.dynamic_variants[variantKey]) {
                    const variant = line.dynamic_variants[variantKey];
                    console.log("Selected variant:", variant);
                    
                    // Update the character name and tone for this line
                    if (variant.character_name) {
                        player.SetVar("npcName", String(variant.character_name));
                    }
                    
                    // Get the text and replace placeholders
                    let text = variant.text;
                    
                    // Replace character name placeholder
                    const userCharacterName = player.GetVar("UserCharacterName") || "";
                    text = text.replace(/{characterName}/g, userCharacterName);
                    
                    // Replace item placeholders if they exist
                    if (variantKey === "missing_items" || variantKey === "both_errors") {
                        const multichoiceResponse = player.GetVar("multichoiceResponse_3");
                        if (multichoiceResponse) {
                            const userChoices = JSON.parse(multichoiceResponse);
                            const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
                            if (interaction3) {
                                // Get missing items (expected yes, answered no)
                                const missingItems = [];
                                // Get the correct options based on content selection
                                let options = interaction3.multi_choice_option || [];
                                if (interaction3.content_selection) {
                                    const previousResponse = player.GetVar(`lastResponse_${interaction3.content_selection.from_interaction}`);
                                    if (previousResponse !== undefined && previousResponse !== null) {
                                        const contentSelector = previousResponse;
                                        if (interaction3.content_sets && interaction3.content_sets[contentSelector]) {
                                            const selectedContent = interaction3.content_sets[contentSelector];
                                            options = selectedContent.multi_choice_option || [];
                                        }
                                    }
                                }
                                userChoices.forEach((choice) => {
                                    // Find the matching option by text instead of by index
                                    const matchingOption = options.find(option => option.text === choice.option);
                                    if (matchingOption && matchingOption.expected_response === "yes" && choice.selection === "no") {
                                        missingItems.push(choice.option);
                                    }
                                });
                                const missingItemsText = formatItemList(missingItems);
                                text = text.replace(/{missing_items}/g, missingItemsText);
                            }
                        }
                    }
                    
                    if (variantKey === "unnecessary_items" || variantKey === "both_errors") {
                        const multichoiceResponse = player.GetVar("multichoiceResponse_3");
                        if (multichoiceResponse) {
                            const userChoices = JSON.parse(multichoiceResponse);
                            const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
                            if (interaction3) {
                                // Get unnecessary items (expected no, answered yes)
                                const unnecessaryItems = [];
                                // Get the correct options based on content selection
                                let options = interaction3.multi_choice_option || [];
                                if (interaction3.content_selection) {
                                    const previousResponse = player.GetVar(`lastResponse_${interaction3.content_selection.from_interaction}`);
                                    if (previousResponse !== undefined && previousResponse !== null) {
                                        const contentSelector = previousResponse;
                                        if (interaction3.content_sets && interaction3.content_sets[contentSelector]) {
                                            const selectedContent = interaction3.content_sets[contentSelector];
                                            options = selectedContent.multi_choice_option || [];
                                        }
                                    }
                                }
                                userChoices.forEach((choice) => {
                                    // Find the matching option by text instead of by index
                                    const matchingOption = options.find(option => option.text === choice.option);
                                    if (matchingOption && matchingOption.expected_response === "no" && choice.selection === "yes") {
                                        unnecessaryItems.push(choice.option);
                                    }
                                });
                                const unnecessaryItemsText = formatItemList(unnecessaryItems);
                                text = text.replace(/{unnecessary_items}/g, unnecessaryItemsText);
                            }
                        }
                    }
                    
                    console.log("Final constructed text:", text);
                    return text;
                } else {
                    console.error("Variant not found:", variantKey);
                    return null;
                }
            } else {
                console.error("Dynamic line selection returned null");
                return null;
            }
        }
        
        // Get the stored multichoice response from the source interaction
        const multichoiceResponse = player.GetVar(`multichoiceResponse_${sourceInteractionId}`);
        console.log("multichoiceResponse value:", multichoiceResponse);
        
        if (!multichoiceResponse || multichoiceResponse === "undefined" || multichoiceResponse === "null") {
            console.log("No multichoice data found for feedback construction");
            return null;
        }
        
        let userChoices;
        try {
            userChoices = JSON.parse(multichoiceResponse);
        } catch (parseError) {
            console.error("Error parsing multichoiceResponse:", parseError);
            console.error("Raw value:", multichoiceResponse);
            return null;
        }
        console.log("User choices:", userChoices);
        
        // Find items based on the logic configuration
        const selectedItems = [];
        userChoices.forEach((choice, index) => {
            console.log(`Processing choice ${index}:`, choice);
            if (choice && choice.selection === logic.selection_type) {
                console.log(`Adding item: ${choice.option}`);
                selectedItems.push(choice.option);
            }
        });
        
        console.log("Selected items:", selectedItems);
        
        // Construct the feedback message using the template
        let feedbackMessage = template.prefix;
        
        if (selectedItems.length === 1) {
            feedbackMessage += selectedItems[0] + template.suffix;
        } else if (selectedItems.length === 2) {
            feedbackMessage += selectedItems[0] + template.separator + selectedItems[1] + template.suffix;
        } else if (selectedItems.length > 2) {
            // For 3 or more items, use proper list formatting
            const itemsCopy = [...selectedItems]; // Create a copy to avoid modifying original array
            const lastItem = itemsCopy.pop();
            feedbackMessage += itemsCopy.join(template.list_separator) + template.list_final_separator + lastItem + template.suffix;
        } else {
            // No items selected
            feedbackMessage += template.no_items_message;
        }
        
        console.log("Constructed feedback message:", feedbackMessage);
        
        // Get the new_prompt text if it exists in the source interaction
        const sourceInteraction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(sourceInteractionId));
        console.log("Found source interaction:", sourceInteraction);
        const newPromptText = sourceInteraction?.npc?.new_prompt?.text || "";
        console.log("New prompt text:", newPromptText);
        
        // Combine feedback and new prompt
        if (newPromptText) {
            return `${feedbackMessage}\n${newPromptText}`;
        } else {
            return feedbackMessage;
        }
        
    } catch (error) {
        console.error("Error constructing feedback from config:", error);
        console.error("Error stack:", error.stack);
        return null;
    }
}

// Helper function to check if a dialogue line should use S3 audio
function shouldUseS3Audio(interactionId, dialogueTurn) {
    // Find the interaction in the data
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
    if (!interaction || !interaction.s3_audio_config) return null;
    
    const config = interaction.s3_audio_config;
    
    // First check for exact line number match
    const exactMatch = config[String(dialogueTurn)];
    if (exactMatch) {
        return exactMatch;
    }
    
    // Then check for line ranges (for backward compatibility)
    for (const [key, url] of Object.entries(config)) {
        if (key.includes('-')) {
            const [start, end] = key.split('-').map(Number);
            if (dialogueTurn >= start && dialogueTurn <= end) {
                return url;
            }
        }
    }
    
    return null;
}

// Helper function to handle dynamic line selection based on multichoice results
function selectDynamicLine(interaction, dialogueTurn) {
    console.log("=== selectDynamicLine DEBUG ===");
    console.log("dialogueTurn:", dialogueTurn);
    console.log("interaction ID:", interaction.interaction_id);
    
    // This function handles dynamic line selection for line 3 based on multichoice results
    if (dialogueTurn !== 3) {
        console.log("dialogueTurn is not 3, returning null");
        return null;
    }
    
    // Get the multichoice response from interaction 3
    const multichoiceResponse = player.GetVar("multichoiceResponse_3");
    console.log("multichoiceResponse_3:", multichoiceResponse);
    
    if (!multichoiceResponse) {
        console.log("No multichoice data found for dynamic line selection");
        return "line_3a"; // Default to success case
    }
    
    let userChoices;
    try {
        userChoices = JSON.parse(multichoiceResponse);
        console.log("Parsed userChoices:", userChoices);
    } catch (parseError) {
        console.error("Error parsing multichoiceResponse:", parseError);
        return "line_3a"; // Default to success case
    }
    
    // Get the expected responses from interaction 3
    const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
    console.log("Found interaction3:", interaction3 ? "yes" : "no");
    if (!interaction3) {
        console.error("Interaction 3 not found");
        return "line_3a";
    }
    
    // Get the correct options based on content selection
    let options = interaction3.multi_choice_option || [];
    console.log("Initial options:", options);
    
    if (interaction3.content_selection) {
        console.log("Content selection found:", interaction3.content_selection);
        const previousResponse = player.GetVar(`lastResponse_${interaction3.content_selection.from_interaction}`);
        console.log(`lastResponse_${interaction3.content_selection.from_interaction}:`, previousResponse);
        
        if (previousResponse !== undefined && previousResponse !== null) {
            const contentSelector = previousResponse;
            console.log("Content selector:", contentSelector);
            if (interaction3.content_sets && interaction3.content_sets[contentSelector]) {
                const selectedContent = interaction3.content_sets[contentSelector];
                options = selectedContent.multi_choice_option || [];
                console.log("Selected content options:", options);
            } else {
                console.log("Content set not found for selector:", contentSelector);
            }
        } else {
            console.log("No previous response found for content selection");
        }
    } else {
        console.log("No content selection in interaction 3");
    }
    
    // Analyze the results and collect items
    let missingItems = []; // expected yes, answered no (user thinks they don't have it but they do)
    let unnecessaryItems = []; // expected no, answered yes (user thinks they have it but they don't)
    
    console.log("Analyzing user choices against expected responses...");
    userChoices.forEach((choice) => {
        console.log(`Choice:`, choice);
        // Find the matching option by text instead of by index
        const matchingOption = options.find(option => option.text === choice.option);
        if (matchingOption) {
            const expectedResponse = matchingOption.expected_response;
            const userSelection = choice.selection;
            console.log(`  Expected: ${expectedResponse}, User selected: ${userSelection}`);
            
            if (expectedResponse === "yes" && userSelection === "no") {
                missingItems.push(choice.option);
                console.log(`  -> Missing item: ${choice.option} (user thinks they don't have it but they do)`);
            } else if (expectedResponse === "no" && userSelection === "yes") {
                unnecessaryItems.push(choice.option);
                console.log(`  -> Unnecessary item: ${choice.option} (user thinks they have it but they don't)`);
            }
        } else {
            console.log(`  No matching option found for: ${choice.option}`);
        }
    });
    
    console.log(`Dynamic line selection analysis: missing items=${missingItems}, unnecessary items=${unnecessaryItems}`);
    
    // Get the user character name
    const userCharacterName = player.GetVar("UserCharacterName") || "";
    
    // Determine which variant to use
    let variantKey;
    if (missingItems.length === 0 && unnecessaryItems.length === 0) {
        variantKey = "success";
    } else if (missingItems.length > 0 && unnecessaryItems.length === 0) {
        variantKey = "missing_items";
    } else if (missingItems.length === 0 && unnecessaryItems.length > 0) {
        variantKey = "unnecessary_items";
    } else {
        variantKey = "both_errors";
    }
    
    console.log("Selected variant:", variantKey);
    
    // Return the variant key for the calling function to handle
    return variantKey;
}

// Helper function to format item lists with proper grammar
function formatItemList(items) {
    if (!items || items.length === 0) {
        return ""; // Return empty string for empty arrays
    } else if (items.length === 1) {
        return items[0];
    } else if (items.length === 2) {
        return items[0] + " and " + items[1];
    } else {
        // For 3 or more items: "item1, item2, and item3"
        const itemsCopy = [...items];
        const lastItem = itemsCopy.pop();
        return itemsCopy.join(", ") + ", and " + lastItem;
    }
}

// Helper function to handle dialogue completion and endpoint navigation
function handleDialogueCompletion(interaction, numericId) {
    console.log("runDialogue: end of dialogue, setting lastResponse");
    player.SetVar(`lastResponse_${numericId}`, "0");
    
    // Mark interaction as visited
    if (window.markInteractionAsVisited) {
        window.markInteractionAsVisited(numericId);
    }
    
    // Check and apply endpoint navigation rules for dialogue interactions
    const currentStage = player.GetVar("interactionStage");
    console.log("=== runDialogue Debug ===");
    console.log("Calling checkAndApplyEndpointRules for dialogue with:");
    console.log("  numericId:", numericId);
    console.log("  responseObj:", { dialogueComplete: true });
    console.log("  interactionType: dialogue");
    console.log("  currentStage:", currentStage);
    console.log("  interaction:", interaction);
    checkAndApplyEndpointRules(numericId, { dialogueComplete: true }, "dialogue", currentStage, interaction, false);
}

// Dialogue runner
function runDialogue() {
    const currentInteractionId = player.GetVar("currentInteractionId");
    const numericId = Number(currentInteractionId);
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === numericId);
    console.log("runDialogue called");
    console.log("currentInteractionId:", currentInteractionId);
    if (!interaction || interaction.interaction_type !== "dialogue") {
        console.error("runDialogue called for non-dialogue interaction");
        return;
    }
    const dialogueTurn = Number(player.GetVar("dialogueTurn"));
    const userCharacterName = player.GetVar("UserCharacterName") || "User";
    console.log("dialogueTurn:", dialogueTurn, "userCharacterName:", userCharacterName);
    
    // Check if this is a feedback construction line
    const feedbackConfigs = interaction.feedback_constructions || [];
    console.log("Available feedback configs:", feedbackConfigs.map(c => ({ line: c.transplant_into_line, type: c.logic.selection_type })));
    const matchingFeedbackConfig = feedbackConfigs.find(config => config.transplant_into_line === dialogueTurn);
    console.log("Matching feedback config for line", dialogueTurn, ":", matchingFeedbackConfig ? "found" : "not found");
    
    if (matchingFeedbackConfig) {
        // Insert constructed feedback at this line
        console.log("runDialogue: inserting constructed feedback at line", dialogueTurn);
        const feedbackMessage = window.constructFeedbackFromConfig ? window.constructFeedbackFromConfig(interaction, matchingFeedbackConfig) : null;
        console.log("Constructed feedbackMessage:", feedbackMessage);
        player.SetVar("npcText", feedbackMessage ? String(feedbackMessage) : "");
        // Update the NPC name for feedback (use the character from the line)
        const feedbackLineKey = `line_${dialogueTurn}`;
        const feedbackLine = interaction[feedbackLineKey];
        
        // For dynamic variants, we need to get the character from the selected variant
        let characterId = null;
        let characterName = null;
        let tone = null;
        
        if (feedbackLine && feedbackLine.dynamic_variants) {
            // This is a dynamic line, get the variant info
            const variantKey = window.selectDynamicLine ? window.selectDynamicLine(interaction, dialogueTurn) : null;
            if (variantKey && feedbackLine.dynamic_variants[variantKey]) {
                const variant = feedbackLine.dynamic_variants[variantKey];
                characterId = variant.character_id;
                characterName = variant.character_name;
                tone = variant.tone;
                player.SetVar("npcName", String(characterName));
            }
        } else if (feedbackLine && feedbackLine.character_name) {
            // Regular line
            characterId = feedbackLine.character_id;
            characterName = feedbackLine.character_name;
            tone = feedbackLine.tone;
            player.SetVar("npcName", String(characterName));
        } else if (interaction.npc && interaction.npc.character_name) {
            characterId = interaction.npc.character_id;
            characterName = interaction.npc.character_name;
            player.SetVar("npcName", String(characterName));
        }
        
        // Check if this is a user line
        if (
            characterId === "user" ||
            characterId === "0" ||
            (userCharacterName && (feedbackLine.character_name === userCharacterName || characterId === userCharacterName))
        ) {
            console.log("runDialogue: feedback line is user line, using user TTS");
            // Use user TTS for feedback
            const ttsSettings = window.prepareUserTTSRequestForLine ? window.prepareUserTTSRequestForLine({
                text: feedbackMessage,
                character_id: characterId,
                character_name: characterName,
                tone: tone || "neutral"
            }, interaction, dialogueTurn) : null;
            
            if (ttsSettings && window.ttsAPIHandler) {
                window.ttsAPIHandler.speak(ttsSettings).then(() => {
                    // After TTS completes, increment dialogueTurn if more lines exist
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        // End of dialogue, update lastResponse and check endpoint navigation
                        handleDialogueCompletion(interaction, numericId);
                    }
                }).catch((error) => {
                    console.error("Error in user TTS playback:", error);
                    // Still increment even if TTS fails
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        handleDialogueCompletion(interaction, numericId);
                    }
                });
            } else {
                // Fallback if TTS is not available
                const nextLineKey = `line_${dialogueTurn + 1}`;
                if (interaction[nextLineKey]) {
                    console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                    player.SetVar("dialogueTurn", dialogueTurn + 1);
                } else {
                    handleDialogueCompletion(interaction, numericId);
                }
            }
        } else {
            console.log("runDialogue: feedback line is NPC line, using NPC TTS");
            // Use NPC TTS for feedback
            const characterSettings = window.getNPCVoiceSettingsByCharacterId ? window.getNPCVoiceSettingsByCharacterId(characterId) : null;
            
            // Get the previous line for context
            const previousLineKey = `line_${dialogueTurn - 1}`;
            const previousLine = interaction[previousLineKey];
            const previousText = previousLine ? previousLine.text : "";
            const previousSpeaker = previousLine ? previousLine.character_name : "";
            
            // Create context with the previous line
            const contextCharacterName = characterName || (characterSettings ? characterSettings.character_name : "Unknown");
            const context = previousText ? 
                `Previous line (${previousSpeaker}): "${previousText}"\n\n` +
                `Current response (${contextCharacterName}): "${feedbackMessage}"\n\n` +
                `Tone: ${tone || "feedback"}` :
                `First line of dialogue (${contextCharacterName}): "${feedbackMessage}"\n\n` +
                `Tone: ${tone || "feedback"}`;
            
            const ttsSettings = characterSettings ? {
                text: feedbackMessage,
                voice_id: characterSettings.voice_id,
                settings: characterSettings.base_settings,
                context: context
            } : null;
            
            if (ttsSettings && window.ttsAPIHandler) {
                window.ttsAPIHandler.speak(ttsSettings).then(() => {
                    // After TTS completes, increment dialogueTurn if more lines exist
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        // End of dialogue, update lastResponse and check endpoint navigation
                        handleDialogueCompletion(interaction, numericId);
                    }
                }).catch((error) => {
                    console.error("Error in TTS playback:", error);
                    // Still increment even if TTS fails
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        handleDialogueCompletion(interaction, numericId);
                    }
                });
            } else {
                // Fallback if TTS is not available
                const nextLineKey = `line_${dialogueTurn + 1}`;
                if (interaction[nextLineKey]) {
                    console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                    player.SetVar("dialogueTurn", dialogueTurn + 1);
                } else {
                    handleDialogueCompletion(interaction, numericId);
                }
            }
        }
    } else {
        // Use dialogue JSON as normal
        const lineKey = `line_${dialogueTurn}`;
        const line = interaction[lineKey];
        console.log("runDialogue: using lineKey", lineKey, line);
        if (line && (line.text || line.dynamic_variants)) {
            // Handle dynamic variants
            if (line.dynamic_variants) {
                // This is a dynamic line, get the variant info
                const variantKey = window.selectDynamicLine ? window.selectDynamicLine(interaction, dialogueTurn) : null;
                if (variantKey && line.dynamic_variants[variantKey]) {
                    const variant = line.dynamic_variants[variantKey];
                    
                    // Get the text and replace placeholders
                    let text = variant.text;
                    
                    // Replace character name placeholder
                    const userCharacterName = player.GetVar("UserCharacterName") || "";
                    text = text.replace(/{characterName}/g, userCharacterName);
                    
                    // Replace item placeholders if they exist
                    if (variantKey === "missing_items" || variantKey === "both_errors") {
                        const multichoiceResponse = player.GetVar("multichoiceResponse_3");
                        if (multichoiceResponse) {
                            const userChoices = JSON.parse(multichoiceResponse);
                            const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
                            if (interaction3) {
                                // Get missing items (expected yes, answered no)
                                const missingItems = [];
                                // Get the correct options based on content selection
                                let options = interaction3.multi_choice_option || [];
                                if (interaction3.content_selection) {
                                    const previousResponse = player.GetVar(`lastResponse_${interaction3.content_selection.from_interaction}`);
                                    if (previousResponse !== undefined && previousResponse !== null) {
                                        const contentSelector = previousResponse;
                                        if (interaction3.content_sets && interaction3.content_sets[contentSelector]) {
                                            const selectedContent = interaction3.content_sets[contentSelector];
                                            options = selectedContent.multi_choice_option || [];
                                        }
                                    }
                                }
                                userChoices.forEach((choice) => {
                                    // Find the matching option by text instead of by index
                                    const matchingOption = options.find(option => option.text === choice.option);
                                    if (matchingOption && matchingOption.expected_response === "yes" && choice.selection === "no") {
                                        missingItems.push(choice.option);
                                    }
                                });
                                const missingItemsText = formatItemList(missingItems);
                                text = text.replace(/{missing_items}/g, missingItemsText);
                            }
                        }
                    }
                    
                    if (variantKey === "unnecessary_items" || variantKey === "both_errors") {
                        const multichoiceResponse = player.GetVar("multichoiceResponse_3");
                        if (multichoiceResponse) {
                            const userChoices = JSON.parse(multichoiceResponse);
                            const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
                            if (interaction3) {
                                // Get unnecessary items (expected no, answered yes)
                                const unnecessaryItems = [];
                                // Get the correct options based on content selection
                                let options = interaction3.multi_choice_option || [];
                                if (interaction3.content_selection) {
                                    const previousResponse = player.GetVar(`lastResponse_${interaction3.content_selection.from_interaction}`);
                                    if (previousResponse !== undefined && previousResponse !== null) {
                                        const contentSelector = previousResponse;
                                        if (interaction3.content_sets && interaction3.content_sets[contentSelector]) {
                                            const selectedContent = interaction3.content_sets[contentSelector];
                                            options = selectedContent.multi_choice_option || [];
                                        }
                                    }
                                }
                                userChoices.forEach((choice) => {
                                    // Find the matching option by text instead of by index
                                    const matchingOption = options.find(option => option.text === choice.option);
                                    if (matchingOption && matchingOption.expected_response === "no" && choice.selection === "yes") {
                                        unnecessaryItems.push(choice.option);
                                    }
                                });
                                const unnecessaryItemsText = formatItemList(unnecessaryItems);
                                text = text.replace(/{unnecessary_items}/g, unnecessaryItemsText);
                            }
                        }
                    }
                    
                    player.SetVar("npcText", String(text));
                    player.SetVar("npcName", String(variant.character_name));
                } else {
                    console.error("Variant not found for dynamic line:", variantKey);
                    return;
                }
            } else {
                // Regular line with direct text
                player.SetVar("npcText", String(line.text));
                // Update the NPC name for this line
                if (line.character_name) {
                    player.SetVar("npcName", String(line.character_name));
                }
            }
            
            // Check if we should use S3 audio instead of TTS
            const s3AudioUrl = shouldUseS3Audio(numericId, dialogueTurn);
            if (s3AudioUrl) {
                console.log("runDialogue: using S3 audio for line", dialogueTurn, "URL:", s3AudioUrl);
                
                // Play S3 audio instead of TTS
                if (window.ttsAPIHandler) {
                    window.ttsAPIHandler.playS3Audio(s3AudioUrl).then(() => {
                        // After S3 audio completes, increment dialogueTurn if more lines exist
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            // End of dialogue, update lastResponse and check endpoint navigation
                            handleDialogueCompletion(interaction, numericId);
                        }
                    }).catch((error) => {
                        console.error("Error in S3 audio playback:", error);
                        // Still increment even if S3 audio fails
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            handleDialogueCompletion(interaction, numericId);
                        }
                    });
                } else {
                    // Fallback if TTS handler is not available
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        handleDialogueCompletion(interaction, numericId);
                    }
                }
                return; // Exit early, don't process TTS
            }
            // Check if this is the user speaking
            if (
                line.character_id === "user" ||
                line.character_id === "0" ||
                (userCharacterName && (line.character_name === userCharacterName || line.character_id === userCharacterName))
            ) {
                console.log("runDialogue: user line, using user TTS");
                // Use user TTS
                const ttsSettings = window.prepareUserTTSRequestForLine ? window.prepareUserTTSRequestForLine(line, interaction, dialogueTurn) : null;
                
                if (ttsSettings && window.ttsAPIHandler) {
                    window.ttsAPIHandler.speak(ttsSettings).then(() => {
                        // After TTS completes, increment dialogueTurn if more lines exist
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            // End of dialogue, update lastResponse and check endpoint navigation
                            handleDialogueCompletion(interaction, numericId);
                        }
                    }).catch((error) => {
                        console.error("Error in user TTS playback:", error);
                        // Still increment even if TTS fails
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            handleDialogueCompletion(interaction, numericId);
                        }
                    });
                } else {
                    // Fallback if TTS is not available
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: fallback, incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        handleDialogueCompletion(interaction, numericId);
                    }
                }
            } else {
                // Use NPC TTS
                console.log("runDialogue: NPC line, using NPC TTS");
                const ttsSettings = window.prepareNPCTTSRequestForLine ? window.prepareNPCTTSRequestForLine(line, interaction, dialogueTurn) : null;
                if (ttsSettings && window.ttsAPIHandler) {
                    window.ttsAPIHandler.speak(ttsSettings).then(() => {
                        // After TTS completes, increment dialogueTurn if more lines exist
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            // End of dialogue, update lastResponse
                            handleDialogueCompletion(interaction, numericId);
                        }
                    }).catch((error) => {
                        console.error("Error in TTS playback:", error);
                        // Still increment even if TTS fails
                        const nextLineKey = `line_${dialogueTurn + 1}`;
                        if (interaction[nextLineKey]) {
                            console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                            player.SetVar("dialogueTurn", dialogueTurn + 1);
                        } else {
                            handleDialogueCompletion(interaction, numericId);
                        }
                    });
                } else {
                    // Fallback if TTS is not available
                    const nextLineKey = `line_${dialogueTurn + 1}`;
                    if (interaction[nextLineKey]) {
                        console.log("runDialogue: incrementing dialogueTurn to", dialogueTurn + 1);
                        player.SetVar("dialogueTurn", dialogueTurn + 1);
                    } else {
                        handleDialogueCompletion(interaction, numericId);
                    }
                }
            }
        } else {
            // No more lines, end dialogue
            handleDialogueCompletion(interaction, numericId);
        }
    }
}

// Export functions for use in Storyline
window.initializeOptions = initializeOptions;
window.initializeTTSState = initializeTTSState;
window.processUserResponse = processUserResponse;
window.buildReordResponseAndSubmit = buildReordResponseAndSubmit;
window.processMultiChoiceResponse = processMultiChoiceResponse;
window.constructFeedbackFromConfig = constructFeedbackFromConfig;
window.runDialogue = runDialogue;
window.shouldUseS3Audio = shouldUseS3Audio;
window.selectDynamicLine = selectDynamicLine;
window.getNpcTextForFeedback = getNpcTextForFeedback;

// Debug function to manually test initialization
window.debugInitializeOptions = function() {
    console.log("=== MANUAL DEBUG INITIALIZATION ===");
    console.log("Testing if initializeOptions can be called manually");
    console.log("Current interaction ID:", player.GetVar("currentInteractionId"));
    console.log("Interaction data available:", !!window.interactionData);
    
    if (window.interactionData) {
        console.log("Available interactions:", window.interactionData.interactions.map(i => i.interaction_id));
    }
    
    // Try to call initializeOptions
    if (typeof initializeOptions === 'function') {
        console.log("initializeOptions function is available, calling it...");
        initializeOptions();
    } else {
        console.error("initializeOptions function is not available");
    }
};