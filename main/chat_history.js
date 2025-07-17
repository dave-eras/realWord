// Chat History System for Real World Interactions
// Provides functions to retrieve and display conversation history

// Helper function to get reorder response metadata for chat history
function getReordResponseMetadata(interactionId) {
    const reordResponse = player.GetVar(`reordResponse_${interactionId}`);
    if (!reordResponse) return null;
    
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
    if (!interaction || !interaction.expectations) return null;
    
    const response = reordResponse.trim();
    const expectations = interaction.expectations;
    
    // Determine which expectation level was matched
    let matchInfo = null;
    
    // Check high expectations
    if (Array.isArray(expectations.high)) {
        const index = expectations.high.findIndex(exp => exp === response);
        if (index !== -1) {
            matchInfo = { level: "high", index: index };
        }
    } else if (typeof expectations.high === "string" && expectations.high === response) {
        matchInfo = { level: "high", index: 0 };
    }
    
    // Check medium expectations
    if (!matchInfo && Array.isArray(expectations.medium)) {
        const index = expectations.medium.findIndex(exp => exp === response);
        if (index !== -1) {
            matchInfo = { level: "medium", index: index };
        }
    }
    
    // Check low expectations
    if (!matchInfo && Array.isArray(expectations.low)) {
        const index = expectations.low.findIndex(exp => exp === response);
        if (index !== -1) {
            matchInfo = { level: "low", index: index };
        }
    }
    
    if (!matchInfo) return null;
    
    // Get the specific phrase that was matched
    const matchedPhrase = expectations[matchInfo.level][matchInfo.index];
    
    return {
        level: matchInfo.level,
        index: matchInfo.index,
        phrase: matchedPhrase,
        // Add metadata from expectations
        topic: interaction.expectations.topic,
        function: interaction.expectations.function,
        tone: interaction.expectations.tone,
        formality: interaction.expectations.formality
    };
}

// Helper function to get detailed response metadata for one-step and two-step interactions
function getDetailedResponseMetadata(interactionId) {
    // First try to get the stored MCQResponse for chat history
    const mcqResponse = player.GetVar(`MCQResponse_${interactionId}`);
    if (mcqResponse) {
        try {
            const responseObj = JSON.parse(mcqResponse);
            return {
                id: responseObj.id,
                text: responseObj.text,
                topic: responseObj.topic,
                function: responseObj.function,
                tone: responseObj.tone,
                formality: responseObj.formality,
                audio: responseObj.audio
            };
        } catch (error) {
            console.error("Error parsing MCQResponse:", error);
        }
    }
    
    // Fallback to the old method using lastResponseId
    const lastResponseId = player.GetVar(`lastResponse_${interactionId}`);
    if (lastResponseId === undefined || lastResponseId === null) return null;
    
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
    if (!interaction || !interaction.detailed_responses) return null;
    
    // Find the response by id (if present) or by zero-based index
    const responseObj = interaction.detailed_responses.find((r, idx) => 
        (r.id !== undefined ? r.id == lastResponseId : idx == lastResponseId)
    );
    
    if (!responseObj) return null;
    
    return {
        id: responseObj.id,
        text: responseObj.text,
        topic: responseObj.topic,
        function: responseObj.function,
        tone: responseObj.tone,
        formality: responseObj.formality,
        audio: responseObj.audio
    };
}

// Helper function to construct user speech for multichoice interactions
function constructMultichoiceUserSpeech(interactionId, userChoices) {
    console.log(`constructMultichoiceUserSpeech called for interaction ${interactionId}:`, userChoices);
    
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
    if (!interaction) return null;
    
    // Get the correct options based on content selection (same logic as in text_handler.js)
    let options = interaction.multi_choice_option || [];
    
    // Check if there's a previous interaction that set a lastResponse for content selection
    if (interaction.content_selection) {
        const previousResponse = player.GetVar(`lastResponse_${interaction.content_selection.from_interaction}`);
        if (previousResponse !== undefined && previousResponse !== null) {
            const contentSelector = previousResponse;
            if (interaction.content_sets && interaction.content_sets[contentSelector]) {
                const selectedContent = interaction.content_sets[contentSelector];
                options = selectedContent.multi_choice_option || [];
            }
        }
    }
    
    console.log('Options for speech construction:', options);
    
    // Add expected responses to the choices
    const choicesWithExpected = userChoices.map(choice => {
        const matchingOption = options.find(option => option.text === choice.option);
        return {
            ...choice,
            expected_response: matchingOption ? matchingOption.expected_response : null
        };
    });
    
    console.log('Choices with expected responses:', choicesWithExpected);
    
    // Find items we have (selected "yes" and expected "yes")
    const itemsWeHave = choicesWithExpected
        .filter(choice => choice.selection === "yes" && choice.expected_response === "yes")
        .map(choice => choice.option);
    
    // Find items we don't have (selected "no" and expected "no")
    const itemsWeDontHave = choicesWithExpected
        .filter(choice => choice.selection === "no" && choice.expected_response === "no")
        .map(choice => choice.option);
    
    // Find missing items (selected "no" but expected "yes")
    const missingItems = choicesWithExpected
        .filter(choice => choice.selection === "no" && choice.expected_response === "yes")
        .map(choice => choice.option);
    
    // Find unnecessary items (selected "yes" but expected "no")
    const unnecessaryItems = choicesWithExpected
        .filter(choice => choice.selection === "yes" && choice.expected_response === "no")
        .map(choice => choice.option);
    
    console.log('Speech construction analysis:', {
        itemsWeHave,
        itemsWeDontHave,
        missingItems,
        unnecessaryItems
    });
    
    // Construct the user's speech based on the results
    let userSpeech = "";
    
    if (itemsWeHave.length > 0) {
        if (itemsWeHave.length === 1) {
            userSpeech += `We have ${itemsWeHave[0]}`;
        } else if (itemsWeHave.length === 2) {
            userSpeech += `We have ${itemsWeHave[0]} and ${itemsWeHave[1]}`;
        } else {
            const lastItem = itemsWeHave.pop();
            userSpeech += `We have ${itemsWeHave.join(", ")}, and ${lastItem}`;
        }
    }
    
    if (itemsWeDontHave.length > 0) {
        if (userSpeech) userSpeech += ". ";
        if (itemsWeDontHave.length === 1) {
            userSpeech += `We don't have ${itemsWeDontHave[0]}`;
        } else if (itemsWeDontHave.length === 2) {
            userSpeech += `We don't have ${itemsWeDontHave[0]} and ${itemsWeDontHave[1]}`;
        } else {
            const lastItem = itemsWeDontHave.pop();
            userSpeech += `We don't have ${itemsWeDontHave.join(", ")}, and ${lastItem}`;
        }
    }
    
    if (missingItems.length > 0) {
        if (userSpeech) userSpeech += ". ";
        if (missingItems.length === 1) {
            userSpeech += `We need ${missingItems[0]}`;
        } else if (missingItems.length === 2) {
            userSpeech += `We need ${missingItems[0]} and ${missingItems[1]}`;
        } else {
            const lastItem = missingItems.pop();
            userSpeech += `We need ${missingItems.join(", ")}, and ${lastItem}`;
        }
    }
    
    if (unnecessaryItems.length > 0) {
        if (userSpeech) userSpeech += ". ";
        if (unnecessaryItems.length === 1) {
            userSpeech += `We have ${unnecessaryItems[0]} but don't need it`;
        } else if (unnecessaryItems.length === 2) {
            userSpeech += `We have ${unnecessaryItems[0]} and ${unnecessaryItems[1]} but don't need them`;
        } else {
            const lastItem = unnecessaryItems.pop();
            userSpeech += `We have ${unnecessaryItems.join(", ")}, and ${lastItem} but don't need them`;
        }
    }
    
    // If no speech was constructed, provide a fallback
    if (!userSpeech) {
        userSpeech = "I've checked what we have.";
    }
    
    console.log('Constructed user speech:', userSpeech);
    return userSpeech;
}

// Helper function to get multichoice response metadata for chat history
function getMultichoiceResponseMetadata(interactionId) {
    const multichoiceResponse = player.GetVar(`multichoiceResponse_${interactionId}`);
    if (!multichoiceResponse) return null;
    
    try {
        const userChoices = JSON.parse(multichoiceResponse);
        const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
        if (!interaction) return null;
        
        // Get the correct options based on content selection (same logic as in text_handler.js)
        let options = interaction.multi_choice_option || [];
        
        // Check if there's a previous interaction that set a lastResponse for content selection
        if (interaction.content_selection) {
            const previousResponse = player.GetVar(`lastResponse_${interaction.content_selection.from_interaction}`);
            if (previousResponse !== undefined && previousResponse !== null) {
                const contentSelector = previousResponse;
                if (interaction.content_sets && interaction.content_sets[contentSelector]) {
                    const selectedContent = interaction.content_sets[contentSelector];
                    options = selectedContent.multi_choice_option || [];
                }
            }
        }
        
        // Construct the user's actual speech message
        const userSpeech = constructMultichoiceUserSpeech(interactionId, userChoices);
        
        // Add expected responses to the choices for feedback calculation
        const choicesWithExpected = userChoices.map(choice => {
            const matchingOption = options.find(option => option.text === choice.option);
            return {
                ...choice,
                expected_response: matchingOption ? matchingOption.expected_response : null
            };
        });
        
        return {
            text: userSpeech, // Use the constructed speech instead of technical summary
            choices: choicesWithExpected,
            interactionType: "multichoice",
            // Add metadata from expectations if available
            topic: interaction.expectations?.topic,
            function: interaction.expectations?.function,
            tone: interaction.expectations?.tone,
            formality: interaction.expectations?.formality
        };
    } catch (error) {
        console.error("Error parsing multichoice response:", error);
        return null;
    }
}

// Helper function to get end-point response metadata for chat history
function getEndPointResponseMetadata(interactionId) {
    const endPointResponse = player.GetVar(`endPointResponse_${interactionId}`);
    if (!endPointResponse) return null;
    
    try {
        const responseObj = JSON.parse(endPointResponse);
        return {
            id: responseObj.id,
            text: responseObj.text,
            topic: responseObj.topic,
            function: responseObj.function,
            tone: responseObj.tone,
            formality: responseObj.formality,
            audio: responseObj.audio,
            interactionType: "end-point"
        };
    } catch (error) {
        console.error("Error parsing endPointResponse:", error);
        return null;
    }
}

// Helper function to construct feedback for chat history (simplified version)
function constructFeedbackForChatHistory(interaction, feedbackConfig) {
    try {
        console.log("constructFeedbackForChatHistory called for interaction:", interaction.interaction_id);
        
        if (!feedbackConfig) {
            console.error("No feedback configuration provided");
            return null;
        }
        
        const config = feedbackConfig;
        const sourceInteractionId = config.source_interaction;
        const template = config.template;
        const logic = config.logic;
        
        console.log("Feedback construction config:", config);
        
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
        return feedbackMessage;
        
    } catch (error) {
        console.error("Error constructing feedback for chat history:", error);
        console.error("Error stack:", error.stack);
        return null;
    }
}

// Helper function to get dialogue response metadata for chat history
function getDialogueResponseMetadata(interactionId) {
    console.log(`getDialogueResponseMetadata called for interaction ${interactionId}`);
    
    const interaction = window.interactionData.interactions.find(i => Number(i.interaction_id) === Number(interactionId));
    if (!interaction || interaction.interaction_type !== "dialogue") {
        console.log('No dialogue interaction found for ID:', interactionId);
        return null;
    }
    
    const dialogueLines = [];
    const userCharacterName = player.GetVar("UserCharacterName") || "User";
    
    console.log('Processing dialogue interaction:', interaction.interaction_id);
    console.log('User character name:', userCharacterName);
    
    // Loop through all dialogue lines (line_0, line_1, line_2, etc.)
    let lineIndex = 0;
    while (true) {
        const lineKey = `line_${lineIndex}`;
        const line = interaction[lineKey];
        
        if (!line) {
            console.log(`No more lines found at index ${lineIndex}`);
            break; // No more lines
        }
        
        console.log(`Processing line ${lineIndex}:`, line);
        
        // Check if this line has feedback construction
        const feedbackConfigs = interaction.feedback_constructions || [];
        const matchingFeedbackConfig = feedbackConfigs.find(config => config.transplant_into_line === lineIndex);
        
        // Skip empty lines, but NOT if they have feedback construction or dynamic variants
        if (!line.text && !line.dynamic_variants && !matchingFeedbackConfig) {
            console.log(`Skipping empty line ${lineIndex}`);
            lineIndex++;
            continue;
        }
        
        // Handle dynamic variants
        let text = line.text || "";
        let characterName = line.character_name || "";
        let characterId = line.character_id || "";
        
        if (line.dynamic_variants) {
            console.log(`Line ${lineIndex} has dynamic variants:`, line.dynamic_variants);
            // This is a dynamic line, get the variant info
            const variantKey = window.selectDynamicLine ? window.selectDynamicLine(interaction, lineIndex) : null;
            console.log(`Selected variant key for line ${lineIndex}:`, variantKey);
            if (variantKey && line.dynamic_variants[variantKey]) {
                const variant = line.dynamic_variants[variantKey];
                text = variant.text || "";
                characterName = variant.character_name || "";
                characterId = variant.character_id || "";
                console.log(`Using variant ${variantKey}:`, variant);
            }
        }
        
        // Handle feedback construction lines (only if no dynamic variants were processed)
        if (!line.dynamic_variants && matchingFeedbackConfig) {
            console.log(`Line ${lineIndex} uses feedback construction:`, matchingFeedbackConfig);
            
            // Use our local feedback construction function instead of the global one
            const feedbackMessage = constructFeedbackForChatHistory(interaction, matchingFeedbackConfig);
            if (feedbackMessage) {
                text = feedbackMessage;
                console.log(`Constructed feedback for line ${lineIndex}:`, text);
            } else {
                console.log(`No feedback message constructed for line ${lineIndex}`);
                console.log(`This might be because multichoice response is not available or constructFeedbackFromConfig failed`);
                
                // Check if multichoice response exists
                const sourceInteractionId = matchingFeedbackConfig.source_interaction;
                const multichoiceResponse = player.GetVar(`multichoiceResponse_${sourceInteractionId}`);
                console.log(`Multichoice response for interaction ${sourceInteractionId}:`, multichoiceResponse);
                
                // Instead of skipping the line, provide a fallback message
                if (matchingFeedbackConfig.logic.selection_type === "yes") {
                    text = "[User feedback about items we have]";
                } else if (matchingFeedbackConfig.logic.selection_type === "no") {
                    text = "[User feedback about items we need]";
                } else if (matchingFeedbackConfig.logic.selection_type === "dynamic_line_selection") {
                    text = "[Dynamic feedback based on multichoice results]";
                } else {
                    text = "[Constructed feedback]";
                }
                console.log(`Using fallback text for line ${lineIndex}:`, text);
            }
        }
        
        // Replace character name placeholders
        if (text.includes("{characterName}")) {
            text = text.replace(/{characterName}/g, userCharacterName);
            console.log(`Replaced character name placeholder in line ${lineIndex}:`, text);
        }
        
        // Replace item placeholders for dynamic variants
        if (text.includes("{missing_items}") || text.includes("{unnecessary_items}")) {
            const multichoiceResponse = player.GetVar("multichoiceResponse_3");
            if (multichoiceResponse) {
                try {
                    const userChoices = JSON.parse(multichoiceResponse);
                    const interaction3 = window.interactionData.interactions.find(i => Number(i.interaction_id) === 3);
                    if (interaction3) {
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
                        
                        // Get missing items (expected yes, answered no)
                        if (text.includes("{missing_items}")) {
                            const missingItems = [];
                            userChoices.forEach((choice) => {
                                const matchingOption = options.find(option => option.text === choice.option);
                                if (matchingOption && matchingOption.expected_response === "yes" && choice.selection === "no") {
                                    missingItems.push(choice.option);
                                }
                            });
                            const missingItemsText = formatItemList(missingItems);
                            text = text.replace(/{missing_items}/g, missingItemsText);
                            console.log(`Replaced missing_items placeholder in line ${lineIndex}:`, missingItemsText);
                        }
                        
                        // Get unnecessary items (expected no, answered yes)
                        if (text.includes("{unnecessary_items}")) {
                            const unnecessaryItems = [];
                            userChoices.forEach((choice) => {
                                const matchingOption = options.find(option => option.text === choice.option);
                                if (matchingOption && matchingOption.expected_response === "no" && choice.selection === "yes") {
                                    unnecessaryItems.push(choice.option);
                                }
                            });
                            const unnecessaryItemsText = formatItemList(unnecessaryItems);
                            text = text.replace(/{unnecessary_items}/g, unnecessaryItemsText);
                            console.log(`Replaced unnecessary_items placeholder in line ${lineIndex}:`, unnecessaryItemsText);
                        }
                    }
                } catch (error) {
                    console.error("Error processing item placeholders:", error);
                }
            }
        }
        
        // Determine if this is a user line or NPC line
        let speaker = "NPC";
        if (
            characterId === "user" ||
            characterId === "0" ||
            (userCharacterName && (characterName === userCharacterName || characterId === userCharacterName))
        ) {
            speaker = "User";
        }
        
        console.log(`Line ${lineIndex} determined as ${speaker}: "${text}"`);
        
        // Add the line to our collection
        dialogueLines.push({
            speaker: speaker,
            text: text,
            characterName: characterName,
            characterId: characterId,
            tone: line.tone || "neutral",
            lineIndex: lineIndex
        });
        
        lineIndex++;
    }
    
    console.log(`Dialogue processing complete. Total lines: ${dialogueLines.length}`);
    console.log('Dialogue lines:', dialogueLines);
    
    return {
        dialogueLines: dialogueLines,
        interactionType: "dialogue",
        totalLines: dialogueLines.length
    };
}

// Helper function to check if an interaction was actually visited
function wasInteractionVisited(interactionId) {
    // Get the visited interactions array from Storyline
    let visitedInteractions = [];
    try {
        const visitedInteractionsStr = player.GetVar("visitedInteractions");
        if (visitedInteractionsStr) {
            visitedInteractions = JSON.parse(visitedInteractionsStr);
        }
    } catch (error) {
        console.error("Error parsing visitedInteractions:", error);
        visitedInteractions = [];
    }
    
    const isVisited = visitedInteractions.includes(Number(interactionId));
    console.log(`wasInteractionVisited(${interactionId}): visitedInteractions = [${visitedInteractions}], isVisited = ${isVisited}`);
    
    return isVisited;
}

// Helper function to mark an interaction as visited
function markInteractionAsVisited(interactionId) {
    let visitedInteractions = [];
    try {
        const visitedInteractionsStr = player.GetVar("visitedInteractions");
        if (visitedInteractionsStr) {
            visitedInteractions = JSON.parse(visitedInteractionsStr);
        }
    } catch (error) {
        console.error("Error parsing visitedInteractions:", error);
        visitedInteractions = [];
    }
    
    const numericId = Number(interactionId);
    if (!visitedInteractions.includes(numericId)) {
        visitedInteractions.push(numericId);
        player.SetVar("visitedInteractions", JSON.stringify(visitedInteractions));
        console.log(`Marked interaction ${interactionId} as visited. Updated array: [${visitedInteractions}]`);
    }
}

// Main function to build complete chat history
function buildChatHistory() {
    const chatHistory = [];
    const currentInteractionId = player.GetVar("currentInteractionId");
    
    console.log("Building chat history for interactions up to:", currentInteractionId);
    
    // Loop through interactions
    for (let i = 1; i <= currentInteractionId; i++) {
        const interaction = window.interactionData.interactions.find(int => Number(int.interaction_id) === i);
        if (!interaction) continue;
        
        // Check if this interaction was actually visited
        const visited = wasInteractionVisited(i);
        const lastResponse = player.GetVar(`lastResponse_${i}`);
        console.log(`Interaction ${i} (${interaction.interaction_type}) visited: ${visited}, lastResponse: "${lastResponse}"`);
        
        if (!visited) {
            console.log(`Skipping interaction ${i} - not visited`);
            continue;
        }
        
        // Handle dialogue interactions differently
        if (interaction.interaction_type === "dialogue") {
            const dialogueResponse = getDialogueResponseMetadata(i);
            if (dialogueResponse && dialogueResponse.dialogueLines) {
                // Add all dialogue lines to chat history
                dialogueResponse.dialogueLines.forEach(line => {
                    chatHistory.push({
                        speaker: line.speaker,
                        text: line.text,
                        interactionId: i,
                        characterId: line.characterId,
                        characterName: line.characterName,
                        interactionType: "dialogue",
                        metadata: {
                            tone: line.tone,
                            lineIndex: line.lineIndex,
                            interactionType: "dialogue"
                        }
                    });
                });
            }
        } else if (interaction.interaction_type !== "multichoice") {
            // Handle non-dialogue, non-multichoice interactions
            // Get NPC text from stored variable
            const npcText = player.GetVar(`npcText_${i}`) || (interaction.npc && interaction.npc.text) || "NPC message";
            chatHistory.push({
                speaker: "NPC",
                text: npcText,
                interactionId: i,
                characterId: interaction.npc && interaction.npc.character_id ? interaction.npc.character_id : "1",
                characterName: interaction.npc && interaction.npc.character_name ? interaction.npc.character_name : "NPC",
                interactionType: interaction.interaction_type
            });
            
            // Get user response metadata
            let userResponse = null;
            if (interaction.interaction_type === "reord") {
                userResponse = getReordResponseMetadata(i);
            } else if (interaction.interaction_type === "end-point") {
                userResponse = getEndPointResponseMetadata(i);
            } else {
                userResponse = getDetailedResponseMetadata(i);
            }
            
            if (userResponse) {
                chatHistory.push({
                    speaker: "User",
                    text: userResponse.text || userResponse.phrase,
                    metadata: userResponse,
                    interactionId: i,
                    interactionType: interaction.interaction_type
                });
            }
        }
        // Skip multichoice interactions entirely - they don't appear in chat history
    }
    
    console.log("Chat history built with", chatHistory.length, "entries");
    return chatHistory;
}

// Function to refresh the iframe chat history
function refreshIframeChatHistory() {
    const iframe = document.querySelector('iframe[src*="index.html"]');
    if (iframe && iframe.contentWindow) {
        try {
            // Call the iframe's refresh function directly
            if (iframe.contentWindow.refreshChatHistory) {
                iframe.contentWindow.refreshChatHistory();
                console.log("Chat history refreshed successfully");
            } else {
                console.warn("refreshChatHistory function not found in iframe");
            }
        } catch (error) {
            console.error("Error refreshing chat history:", error);
        }
    } else {
        console.warn("Iframe not found for chat history refresh");
    }
}

// Function to display chat history in console (for testing)
function displayChatHistory() {
    const history = buildChatHistory();
    console.log("=== CHAT HISTORY ===");
    history.forEach((entry, index) => {
        console.log(`${index + 1}. [${entry.speaker}] ${entry.text}`);
        if (entry.metadata) {
            console.log(`   Metadata:`, entry.metadata);
        }
    });
    console.log("===================");
}

// Function to open chat history (call this from Storyline button)
function openChatHistory() {
    try {
        console.log("Attempting to open chat history...");
        
        // Check if chat history functions are loaded
        if (typeof window.refreshIframeChatHistory === 'function') {
            window.refreshIframeChatHistory();
            console.log("Chat history refreshed successfully");
        } else {
            console.error("refreshIframeChatHistory function not found. Available functions:", Object.keys(window).filter(key => key.includes('Chat') || key.includes('chat')));
            
            // Try alternative approach
            if (window.buildChatHistory) {
                console.log("buildChatHistory found, trying to display in console...");
                window.displayChatHistory();
            } else {
                console.error("No chat history functions available");
            }
        }
    } catch (error) {
        console.error("Error opening chat history:", error);
    }
}

// Function to wait for chat history to be ready
function waitForChatHistory() {
    return new Promise((resolve) => {
        const checkFunction = () => {
            if (typeof window.openChatHistory === 'function') {
                resolve();
            } else {
                setTimeout(checkFunction, 100);
            }
        };
        checkFunction();
    });
}

// Export functions for use in other modules
window.getReordResponseMetadata = getReordResponseMetadata;
window.getDetailedResponseMetadata = getDetailedResponseMetadata;
window.getMultichoiceResponseMetadata = getMultichoiceResponseMetadata;
window.getEndPointResponseMetadata = getEndPointResponseMetadata;
window.getDialogueResponseMetadata = getDialogueResponseMetadata;
window.wasInteractionVisited = wasInteractionVisited;
window.markInteractionAsVisited = markInteractionAsVisited;
window.constructMultichoiceUserSpeech = constructMultichoiceUserSpeech;
window.constructFeedbackForChatHistory = constructFeedbackForChatHistory;
window.buildChatHistory = buildChatHistory;
window.displayChatHistory = displayChatHistory;
window.refreshIframeChatHistory = refreshIframeChatHistory;
window.openChatHistory = openChatHistory;

// Helper function to format item lists with proper grammar (copied from text_handler.js)
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