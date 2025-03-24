// Silence Cutter ExtendScript for Premiere Pro

// Analyze a sequence for silence
function analyzeSilence(paramsStr) {
    // Debug log
    $.writeln("------------------------------------");
    $.writeln("analyzeSilence called with: " + paramsStr);
    
    // Add more detailed debug info
    $.writeln("App available: " + (typeof app !== 'undefined'));
    if (typeof app !== 'undefined') {
        $.writeln("Project available: " + (typeof app.project !== 'undefined'));
        if (typeof app.project !== 'undefined') {
            $.writeln("Active sequence available: " + (typeof app.project.activeSequence !== 'undefined'));
        }
    }
    
    try {
        // Parse parameters
        // Add error checking for paramsStr
        if (!paramsStr || typeof paramsStr !== "string") {
            return JSON.stringify({
                error: "Invalid parameters format"
            });
        }
        
        var params;
        try {
            params = JSON.parse(paramsStr);
        } catch (e) {
            return JSON.stringify({
                error: "Failed to parse parameters: " + e.message
            });
        }
        
        var threshold = parseFloat(params.threshold);         // dB threshold
        var minDuration = parseInt(params.minDuration);       // ms
        var padding = parseInt(params.padding);               // ms
        
        // Check if app and project exist
        if (!app || !app.project) {
            return JSON.stringify({
                error: "Could not access Premiere Pro project."
            });
        }
        
        // Get active sequence
        var activeSequence = app.project.activeSequence;
        if (!activeSequence) {
            return JSON.stringify({
                error: "No active sequence. Please select a sequence."
            });
        }
        
        // Check for audio tracks
        var audioTrackCount = 0;
        
        // Verify audioTracks exists
        if (!activeSequence.audioTracks) {
            return JSON.stringify({
                error: "Could not access audio tracks."
            });
        }
        
        try {
            for (var i = 0; i < activeSequence.audioTracks.numTracks; i++) {
                // Safely check if track and clips exist
                if (activeSequence.audioTracks[i] && 
                    activeSequence.audioTracks[i].clips && 
                    activeSequence.audioTracks[i].clips.numItems > 0) {
                    audioTrackCount++;
                }
            }
        } catch(e) {
            return JSON.stringify({
                error: "Error checking audio tracks: " + e.message
            });
        }
        
        if (audioTrackCount === 0) {
            return JSON.stringify({
                error: "No audio tracks found in the sequence."
            });
        }
        
        // Get sequence details with error checking
        var fps, sequenceDuration;
        try {
            // Check if sequence has necessary properties
            if (!activeSequence.timebase) {
                $.writeln("Warning: timebase not available, using default 30fps");
                fps = 30; // Default fallback
            } else if (!activeSequence.timeDisplayFormat || !activeSequence.timeDisplayFormat.ticks) {
                $.writeln("Warning: timeDisplayFormat not available, calculating fps alternatively");
                fps = activeSequence.timebase / 254016000000; // Default ticks per second
            } else {
                fps = activeSequence.timebase / activeSequence.timeDisplayFormat.ticks;
            }
            
            // Get sequence duration
            if (!activeSequence.end || typeof activeSequence.end.seconds !== 'number') {
                $.writeln("Warning: end time not available, using default 60 seconds");
                sequenceDuration = 60; // Default fallback
            } else {
                sequenceDuration = activeSequence.end.seconds;
            }
            
            var sampleRate = 48000; // typical audio sample rate
            
            $.writeln("Sequence details - FPS: " + fps + ", Duration: " + sequenceDuration);
        } catch(e) {
            return JSON.stringify({
                error: "Error getting sequence details: " + e.message
            });
        }
        
        // For demo/MVP, we'll simulate the audio analysis process
        // In a production version, this would do actual audio analysis of the sequence
        
        // Simulate finding silence markers
        var markers = simulateSilenceDetection(sequenceDuration, threshold, minDuration, fps);
        
        // Return the analysis results
        return JSON.stringify({
            count: markers.length,
            totalDuration: calculateTotalDuration(markers),
            markers: markers,
            sequenceDuration: sequenceDuration,
            fps: fps
        });
    } catch (error) {
        return JSON.stringify({
            error: "Error analyzing silence: " + error.message
        });
    }
}

// Cut silence in a sequence
function cutSilence(paramsStr) {
    // Debug output
    $.writeln("------------------------------------");
    $.writeln("cutSilence called with: " + paramsStr);
    
    // Initial validation
    if (typeof paramsStr !== "string") {
        $.writeln("Error: paramsStr is not a string, it's a " + typeof paramsStr);
        return JSON.stringify({
            error: "Invalid parameter type: expected string, got " + typeof paramsStr
        });
    }
    
    try {
        // Parse parameters
        var params;
        try {
            $.writeln("Attempting to parse: " + paramsStr);
            $.writeln("Parameter type: " + typeof paramsStr);
            $.writeln("Parameter length: " + paramsStr.length);
            // Show first 100 chars
            $.writeln("First 100 chars: " + paramsStr.substring(0, 100));
            
            params = JSON.parse(paramsStr);
            
            $.writeln("Successfully parsed parameters");
            $.writeln("markers present: " + (params.markers ? "yes" : "no"));
            if (params.markers) {
                $.writeln("number of markers: " + params.markers.length);
            }
            $.writeln("padding present: " + (params.padding ? "yes" : "no"));
        } catch (e) {
            $.writeln("JSON parse error: " + e.message);
            $.writeln("JSON parse error stack: " + (e.stack || "no stack available"));
            return JSON.stringify({
                error: "Failed to parse parameters: " + e.message
            });
        }
        
        var markers = params.markers;
        var padding = parseInt(params.padding) / 1000; // convert to seconds
        
        // Get active sequence
        var activeSequence = app.project.activeSequence;
        if (!activeSequence) {
            return JSON.stringify({
                error: "No active sequence. Please select a sequence."
            });
        }
        
        // Alternative approach using standard ExtendScript (no QE DOM and no undo groups)
        // We'll skip using beginUndoGroup since it appears to not be available
        var cutCount = 0;
        
        try {
            // Sort markers in reverse order (to avoid changing timecodes)
            markers.sort(function(a, b) {
                return b.start - a.start;
            });
            
            for (var i = 0; i < markers.length; i++) {
                var start = markers[i].start + padding;
                var end = markers[i].end - padding;
                
                // Skip if padding would make this an invalid cut
                if (start >= end) continue;
                
                $.writeln("Processing cut " + i + ": " + start + " to " + end);
                
                // Create time objects
                var startTime = new Time();
                startTime.seconds = start;
                
                var endTime = new Time();
                endTime.seconds = end;
                
                // Try standard sequence methods
                try {
                    // Select the range (important for the next step)
                    activeSequence.setInPoint(startTime.ticks);
                    activeSequence.setOutPoint(endTime.ticks);
                    
                    // Perform a ripple delete
                    // This is the built-in equivalent of Edit > Ripple Delete
                    app.executeCommand(19); // 19 is the ID for "Ripple Delete"
                    
                    cutCount++;
                    $.writeln("Cut " + i + " successful");
                } catch (cutError) {
                    $.writeln("Error cutting section " + i + ": " + cutError.message);
                }
            }
            
            // Return success
            return JSON.stringify({
                success: true,
                cutCount: cutCount
            });
        } catch (error) {
            return JSON.stringify({
                error: "Error during cutting: " + error.message
            });
        }
    } catch (outerError) {
        return JSON.stringify({
            error: "Outer error: " + outerError.message
        });
    }
}

// Helper function to simulate silence detection
// In a real implementation, this would analyze actual audio data
function simulateSilenceDetection(sequenceDuration, threshold, minDuration, fps) {
    var markers = [];
    var minDurationSec = minDuration / 1000; // convert to seconds
    
    // For demo purposes, create some random silence markers
    // In a real implementation, this would be based on actual audio analysis
    var position = 0;
    while (position < sequenceDuration) {
        // Skip forward a random amount (non-silent section)
        position += Math.random() * 5 + 1;
        
        if (position >= sequenceDuration) break;
        
        // Create a silence of random duration
        var silenceDuration = Math.random() * 2;
        
        // Only include silences longer than the minimum duration
        if (silenceDuration >= minDurationSec) {
            var start = position;
            var end = position + silenceDuration;
            
            if (end <= sequenceDuration) {
                markers.push({
                    start: start,
                    end: end,
                    duration: silenceDuration
                });
            }
        }
        
        position += silenceDuration;
    }
    
    return markers;
}

// Calculate total duration of silence
function calculateTotalDuration(markers) {
    var total = 0;
    for (var i = 0; i < markers.length; i++) {
        total += (markers[i].end - markers[i].start) * 1000; // convert to ms
    }
    return total;
}