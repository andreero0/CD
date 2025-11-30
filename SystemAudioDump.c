#include <CoreAudio/CoreAudio.h>
#include <AudioToolbox/AudioToolbox.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

// Audio format constants
#define SAMPLE_RATE 24000
#define CHANNELS 2
#define BITS_PER_SAMPLE 16
#define BUFFER_SIZE 4800  // 0.1 seconds of audio

// Global audio queue
AudioQueueRef audioQueue = NULL;

// Audio queue callback
static void HandleInputBuffer(void *aqData,
                              AudioQueueRef inAQ,
                              AudioQueueBufferRef inBuffer,
                              const AudioTimeStamp *inStartTime,
                              UInt32 inNumPackets,
                              const AudioStreamPacketDescription *inPacketDesc) {
    // Write audio data to stdout
    if (inBuffer->mAudioDataByteSize > 0) {
        fwrite(inBuffer->mAudioData, 1, inBuffer->mAudioDataByteSize, stdout);
        fflush(stdout);
    }
    
    // Re-enqueue the buffer
    AudioQueueEnqueueBuffer(inAQ, inBuffer, 0, NULL);
}

int main(int argc, char *argv[]) {
    OSStatus status;
    
    // Set up audio format
    AudioStreamBasicDescription audioFormat;
    audioFormat.mSampleRate = SAMPLE_RATE;
    audioFormat.mFormatID = kAudioFormatLinearPCM;
    audioFormat.mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked;
    audioFormat.mBitsPerChannel = BITS_PER_SAMPLE;
    audioFormat.mChannelsPerFrame = CHANNELS;
    audioFormat.mBytesPerFrame = (BITS_PER_SAMPLE / 8) * CHANNELS;
    audioFormat.mFramesPerPacket = 1;
    audioFormat.mBytesPerPacket = audioFormat.mBytesPerFrame;
    audioFormat.mReserved = 0;
    
    // Create audio queue for input
    status = AudioQueueNewInput(&audioFormat,
                               HandleInputBuffer,
                               NULL,
                               NULL,
                               kCFRunLoopCommonModes,
                               0,
                               &audioQueue);
    
    if (status != noErr) {
        fprintf(stderr, "Error creating audio queue: %d\n", (int)status);
        return 1;
    }
    
    // Allocate and enqueue buffers
    for (int i = 0; i < 3; i++) {
        AudioQueueBufferRef buffer;
        status = AudioQueueAllocateBuffer(audioQueue, BUFFER_SIZE, &buffer);
        if (status != noErr) {
            fprintf(stderr, "Error allocating buffer: %d\n", (int)status);
            return 1;
        }
        AudioQueueEnqueueBuffer(audioQueue, buffer, 0, NULL);
    }
    
    // Start recording
    status = AudioQueueStart(audioQueue, NULL);
    if (status != noErr) {
        fprintf(stderr, "Error starting audio queue: %d\n", (int)status);
        return 1;
    }
    
    fprintf(stderr, "SystemAudioDump: Recording started\n");
    
    // Run indefinitely
    CFRunLoopRun();
    
    // Cleanup (never reached in normal operation)
    AudioQueueStop(audioQueue, true);
    AudioQueueDispose(audioQueue, true);
    
    return 0;
}
