// Initialize the Creative Cloud interface
var csInterface = new CSInterface();

// DOM elements
var thresholdSlider = document.getElementById('threshold');
var thresholdValue = document.getElementById('thresholdValue');
var minDurationSlider = document.getElementById('minDuration');
var minDurationValue = document.getElementById('minDurationValue');
var paddingSlider = document.getElementById('padding');
var paddingValue = document.getElementById('paddingValue');
var analyzeBtn = document.getElementById('analyzeBtn');
var cutBtn = document.getElementById('cutBtn');
var statusDiv = document.getElementById('status');
var resultsDiv = document.getElementById('results');
var silenceCountP = document.getElementById('silenceCount');
var totalDurationP = document.getElementById('totalDuration');

// Analysis results
var silenceResults = null;

// Update UI when sliders change
thresholdSlider.addEventListener('input', function() {
    thresholdValue.textContent = this.value + ' dB';
});

minDurationSlider.addEventListener('input', function() {
    minDurationValue.textContent = this.value + ' ms';
});

paddingSlider.addEventListener('input', function() {
    paddingValue.textContent = this.value + ' ms';
});

// Analyze button click handler
analyzeBtn.addEventListener('click', function() {
    updateStatus('Analyzing audio... Please wait.');
    resultsDiv.classList.add('hidden');
    cutBtn.disabled = true;
    
    var params = {
        threshold: thresholdSlider.value,
        minDuration: minDurationSlider.value,
        padding: paddingSlider.value
    };
    
    // Convert the params object to a string for ExtendScript
    var paramsStr = JSON.stringify(params);
    
    // Call ExtendScript function
    // Call ExtendScript function with proper JSON string - using a different approach
    var jsCode = 'analyzeSilence(' + JSON.stringify(paramsStr) + ')';
    console.log("Executing JS code:", jsCode);
    csInterface.evalScript(jsCode, function(result) {
        try {
            // Parse the result
            silenceResults = JSON.parse(result);
            
            if (silenceResults.error) {
                updateStatus('Error: ' + silenceResults.error);
                return;
            }
            
            // Update UI with results
            updateStatus('Analysis complete.');
            silenceCountP.textContent = 'Silences found: ' + silenceResults.count;
            totalDurationP.textContent = 'Total silence duration: ' + 
                (silenceResults.totalDuration / 1000).toFixed(2) + ' sec';
            
            resultsDiv.classList.remove('hidden');
            cutBtn.disabled = false;
        } catch (e) {
            updateStatus('Error parsing results: ' + e.message);
        }
    });
});

// Cut button click handler
cutBtn.addEventListener('click', function() {
    if (!silenceResults || !silenceResults.markers) {
        updateStatus('No analysis results available. Please analyze first.');
        return;
    }
    
    updateStatus('Cutting silences... Please wait.');
    
    var params = {
        markers: silenceResults.markers,
        padding: parseInt(paddingSlider.value)
    };
    
    // Convert the params object to a string for ExtendScript
    var paramsStr = JSON.stringify(params);
    console.log("Sending to ExtendScript:", paramsStr);
    
    // Call ExtendScript function with proper JSON string - using a different approach
    var jsCode = 'cutSilence(' + JSON.stringify(paramsStr) + ')';
    console.log("Executing JS code:", jsCode);
    csInterface.evalScript(jsCode, function(result) {
        // Log the exact raw result for debugging
        console.log("Raw result from ExtendScript (cutSilence):", result);
        document.getElementById('status').innerHTML = '<p>Raw result: ' + result + '</p>';
        
        try {
            // Try to parse JSON with extra safety
            var cutResults;
            if (typeof result === 'string') {
                if (result.trim().startsWith('Error:')) {
                    updateStatus('ExtendScript Error: ' + result);
                    return;
                }
                
                cutResults = JSON.parse(result);
            } else {
                updateStatus('Unexpected result type: ' + typeof result);
                return;
            }
            
            if (cutResults.debug) {
                updateStatus('Debug info: ' + cutResults.debug);
                return;
            }
            
            if (cutResults.error) {
                updateStatus('Error: ' + cutResults.error);
                return;
            }
            
            updateStatus('Successfully cut ' + (cutResults.cutCount || 0) + ' silent sections.');
        } catch (e) {
            console.error("Error parsing result:", e);
            console.error("Result was:", result);
            updateStatus('Error processing results: ' + e.message + '<br>Raw result: ' + result);
        }
    });
});

// Helper function to update status
function updateStatus(message) {
    statusDiv.innerHTML = '<p>' + message + '</p>';
}

// Initialize the panel
function init() {
    updateStatus('Ready to analyze. Select a sequence in Premiere Pro.');
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', init);