// Silence Cutter ExtendScript for Premiere Pro

// Analyze a sequence for silence
function analyzeSilence(paramsStr) {
    try {
        // Parse parameters
        var params = JSON.parse(paramsStr);
        var threshold = parseFloat(params.threshold);         // dB threshold
        var minDuration = parseInt(params.minDuration);       // ms
        var padding = parseInt(params.padding);               // ms
        
        // Get active sequence
        var activeSequence = app.project.activeSequence;
        if (!activeSequence) {
            return JSON.stringify({
                error: "No active sequence. Please select a sequence."
            });
        }
        
        // Check for audio tracks
        var audioTrackCount = 0;
        for (var i = 0; i < activeSequence.audioTracks.numTracks; i++) {
            if (activeSequence.audioTracks[i].clips.numItems > 0) {
                audioTrackCount++;
            }
        }
        
        if (audioTrackCount === 0) {
            return JSON.stringify({
                error: "No audio tracks found in the sequence."
            });
        }
        
        // Get sequence details
        var fps = activeSequence.timebase / activeSequence.timeDisplayFormat.ticks; // frames per second
        var sampleRate = 48000; // typical audio sample rate
        var sequenceDuration = activeSequence.end.seconds; // sequence duration in seconds
        
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
    try {
        // Parse parameters
        var params = JSON.parse(paramsStr);
        var markers = params.markers;
        var padding = parseInt(params.padding) / 1000; // convert to seconds
        
        // Get active sequence
        var activeSequence = app.project.activeSequence;
        if (!activeSequence) {
            return JSON.stringify({
                error: "No active sequence. Please select a sequence."
            });
        }
        
        // Premiere Pro operations to perform the cuts
        // Note: This is a simplified version for the MVP
        app.enableQE(); // Enable Premiere Pro's QE DOM
        var qeSequence = qe.project.getActiveSequence();
        
        if (!qeSequence) {
            return JSON.stringify({
                error: "Could not access the QE sequence."
            });
        }
        
        // Create an undo group for this operation
        app.project.beginUndoGroup("Cut Silences");
        
        // Process the markers in reverse order to avoid changing timecodes
        var cutCount = 0;
        for (var i = markers.length - 1; i >= 0; i--) {
            var start = markers[i].start + padding;
            var end = markers[i].end - padding;
            
            // Skip if the padding would make this an invalid cut
            if (start >= end) continue;
            
            // Create a time object for the start and end
            var startTime = new Time();
            startTime.seconds = start;
            
            var endTime = new Time();
            endTime.seconds = end;
            
            // Select the range
            qeSequence.setInPoint(startTime.ticks);
            qeSequence.setOutPoint(endTime.ticks);
            
            // Ripple delete the selected range
            qeSequence.remove(true); // true for ripple delete
            
            cutCount++;
        }
        
        // End the undo group
        app.project.endUndoGroup();
        
        return JSON.stringify({
            success: true,
            cutCount: cutCount
        });
    } catch (error) {
        // End the undo group in case of error
        app.project.endUndoGroup();
        
        return JSON.stringify({
            error: "Error cutting silence: " + error.message
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