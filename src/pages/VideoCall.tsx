import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, onSnapshot, addDoc, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import web3Service from '../services/web3Service';
import agoraUtils from '../utils/agora';
import { ICameraVideoTrack } from 'agora-rtc-sdk-ng';

interface CallData {
  clientId: string;
  developerId: string;
  status: string;
  duration: number;
  startTime: string | null;
  totalAmount: number;
  walletAddress: string;
  callId: string;
}

const VideoCall = () => {
  const { callId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [callData, setCallData] = useState<CallData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [isCallEnding, setIsCallEnding] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<ICameraVideoTrack | null>(null);

  // Refs
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const callInitialized = useRef(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = (durationInSeconds: number) => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    setTimeLeft(durationInSeconds);
    console.log('Starting timer with duration:', durationInSeconds);

    timerInterval.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (!prev || prev <= 0) {
          if (timerInterval.current) {
            clearInterval(timerInterval.current);
          }
          handleCallEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const initializeVideoCall = async () => {
    try {
      console.log('Initializing video call...');
      
      // Create Agora engine
      const engine = await agoraUtils.createAgoraEngine();
      console.log('Agora engine created');

      // Set up event listeners
      engine.client.on('user-published', async (user, mediaType) => {
        await engine.client.subscribe(user, mediaType);
        console.log('Subscribed to remote user:', mediaType);

        if (mediaType === 'video' && remoteVideoRef.current) {
          const videoTrack = user.videoTrack;
          setRemoteVideoTrack(videoTrack);
          videoTrack.play(remoteVideoRef.current);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      engine.client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
          setRemoteVideoTrack(null);
        }
      });

      // Join channel
      await agoraUtils.joinChannel(callId!);
      console.log('Joined channel');

      // Play local video
      if (localVideoRef.current && engine.localVideoTrack) {
        agoraUtils.playVideo(engine.localVideoTrack, localVideoRef.current);
      }

    } catch (error) {
      console.error('Error initializing video call:', error);
      setError('Failed to initialize video call. Please check camera and microphone permissions.');
    }
  };

  const handleCallEnd = async () => {
    if (!callData || !callId || isCallEnding) return;

    setIsCallEnding(true);
    try {
      console.log('Ending call...', { callData });

      // First, leave the Agora channel
      await agoraUtils.leaveChannel();
      console.log('Left Agora channel');

      const serverTimestamp = await getServerTimestamp();
      
      // Update call status in Firestore
      const callRef = doc(db, 'calls', callId);
      await updateDoc(callRef, {
        status: 'completed',
        endTime: new Date(serverTimestamp).toISOString(),
        endedBy: user?.uid,
        endReason: timeLeft === 0 ? 'timeout' : 'manual',
        requiresPayment: true // Mark that payment needs to be processed
      });
      console.log('Updated call status to completed');

      // Calculate actual duration using server timestamp
      if (callData.startTime) {
        const startTime = new Date(callData.startTime).getTime();
        const actualDuration = Math.floor((serverTimestamp - startTime) / 1000 / 60); // in minutes

        await updateDoc(callRef, {
          actualDuration
        });
        console.log('Updated actual call duration:', actualDuration);
      }

      // Clean up timers
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }

      // Check if current user is the developer
      const isDeveloper = user?.uid === callData.developerId;

      // Process payment if developer, otherwise just mark for payment
      if (isDeveloper && callData.walletAddress && callData.totalAmount && callData.callId) {
        await processPayment(callRef, callData);
      } else {
        // If client is ending the call, notify developer to process payment
        console.log('Client ended call - marking for payment');
        navigate('/client-dashboard');
      }
    } catch (error) {
      console.error('Error ending call:', error);
      setError('Failed to end call properly. Please try again.');
      setIsCallEnding(false);
    }
  };

  // Separate function to handle payment processing
  const processPayment = async (callRef: any, callData: CallData) => {
    try {
      setError(''); // Clear any previous errors
      console.log('Processing payment with callId:', callData.callId);

      // Show loading state
      const loadingMessage = 'Processing payment... Please confirm the transaction in MetaMask.';
      setError(loadingMessage);

      const txHash = await web3Service.completeCall(callData.callId);
      console.log('Payment transaction hash:', txHash);

      // Update payment status in Firestore
      const serverTimestamp = await getServerTimestamp();
      await updateDoc(callRef, {
        paymentReleased: true,
        paymentReleasedAt: new Date(serverTimestamp).toISOString(),
        paymentTransactionHash: txHash,
        requiresPayment: false // Mark payment as processed
      });
      console.log('Updated payment status in Firestore');
      
      // Navigate after successful payment
      navigate('/developer-dashboard');
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
      
      // Update Firestore with error
      await updateDoc(callRef, {
        paymentError: true,
        paymentErrorMessage: error.message
      });
      
      // Don't navigate if payment failed
      setIsCallEnding(false);
    }
  };

  // Listen for payment requirements when developer is in the call
  useEffect(() => {
    if (!callId || !user || !callData) return;

    // Only set up listener if user is the developer
    const isDeveloper = user.uid === callData.developerId;
    if (!isDeveloper) return;

    const callRef = doc(db, 'calls', callId);
    const unsubscribe = onSnapshot(callRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.requiresPayment && !data?.paymentReleased && !isCallEnding) {
        console.log('Payment required - processing payment');
        await processPayment(callRef, callData);
      }
    });

    return () => unsubscribe();
  }, [callId, user, callData]);

  const getServerTimestamp = async () => {
    try {
      const timestampRef = await addDoc(collection(db, 'timestamps'), {
        timestamp: serverTimestamp()
      });
      const timestampDoc = await getDoc(timestampRef);
      const timestamp = timestampDoc.data()?.timestamp?.toMillis();
      
      // Clean up the temporary document
      await deleteDoc(timestampRef);
      
      return timestamp || Date.now();
    } catch (error) {
      console.error('Error getting server timestamp:', error);
      return Date.now();
    }
  };

  useEffect(() => {
    if (!callId || !user) return;

    const fetchCallData = async () => {
      try {
        const callRef = doc(db, 'calls', callId);
        const unsubscribe = onSnapshot(callRef, async (snapshot) => {
          const data = snapshot.data() as CallData;
          setCallData(data);

          if (data.startTime && !callInitialized.current) {
            // Calculate time left based on server timestamp
            const serverTimestamp = await getServerTimestamp();
            const startTime = new Date(data.startTime).getTime();
            const elapsedSeconds = Math.floor((serverTimestamp - startTime) / 1000);
            const remainingSeconds = (data.duration * 60) - elapsedSeconds;
            
            console.log('Timer details:', {
              serverTime: new Date(serverTimestamp).toISOString(),
              startTime: new Date(startTime).toISOString(),
              elapsedSeconds,
              remainingSeconds,
              duration: data.duration
            });

            if (remainingSeconds > 0) {
              startTimer(remainingSeconds);
              callInitialized.current = true;
            } else {
              handleCallEnd();
            }
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error fetching call data:', error);
        setError('Failed to load call data');
      }
    };

    fetchCallData();
  }, [callId, user]);

  useEffect(() => {
    if (timeLeft === 0) {
      handleCallEnd();
    }
  }, [timeLeft]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      handleCallEnd();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!callId) return;

    const callRef = doc(db, 'calls', callId);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      const data = snapshot.data();
      if (data?.status === 'completed' && !isCallEnding) {
        // Other user ended the call
        agoraUtils.leaveChannel();
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
        }
        const isDeveloper = user?.uid === callData?.developerId;
        navigate(isDeveloper ? '/developer-dashboard' : '/client-dashboard');
      }
    });

    return () => unsubscribe();
  }, [callId, isCallEnding]);

  useEffect(() => {
    if (!callId || !user) {
      setError('Invalid call session');
      return;
    }

    const initializeCall = async () => {
      try {
        const callRef = doc(db, 'calls', callId);
        const callSnap = await getDoc(callRef);
        
        if (!callSnap.exists()) {
          setError('Call not found');
          return;
        }

        const data = callSnap.data() as CallData;
        console.log('Call data:', data);
        setCallData(data);

        if (data.status === 'active' && !callInitialized.current) {
          callInitialized.current = true;
          await initializeVideoCall();

          if (data.startTime && data.duration) {
            const startTime = new Date(data.startTime).getTime();
            const currentTime = new Date().getTime();
            const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
            const totalSeconds = data.duration * 60;
            const remainingSeconds = totalSeconds - elapsedSeconds;

            if (remainingSeconds > 0) {
              startTimer(remainingSeconds);
            } else {
              handleCallEnd();
            }
          }
        }

        // Listen for call updates
        const unsubscribe = onSnapshot(callRef, async (snapshot) => {
          const updatedData = snapshot.data() as CallData;
          setCallData(updatedData);

          if (updatedData.status === 'active' && !callInitialized.current) {
            callInitialized.current = true;
            await initializeVideoCall();

            if (!updatedData.startTime) {
              await updateDoc(callRef, {
                startTime: new Date().toISOString()
              });
            } else if (!timeLeft && updatedData.duration) {
              const startTime = new Date(updatedData.startTime).getTime();
              const currentTime = new Date().getTime();
              const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
              const totalSeconds = updatedData.duration * 60;
              const remainingSeconds = totalSeconds - elapsedSeconds;

              if (remainingSeconds > 0) {
                startTimer(remainingSeconds);
              } else {
                handleCallEnd();
              }
            }
          }
        });

        return () => {
          unsubscribe();
          if (timerInterval.current) {
            clearInterval(timerInterval.current);
          }
          agoraUtils.leaveChannel();
        };
      } catch (error) {
        console.error('Error initializing call:', error);
        setError('Failed to initialize call');
      }
    };

    initializeCall();
  }, [callId, user]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Timer Display */}
        <div className="mb-4 text-center">
          <div className="inline-block px-6 py-3 bg-white rounded-lg shadow-lg">
            <span className="text-xl font-semibold text-gray-900">Time Remaining: </span>
            <span className={`text-xl font-bold ${timeLeft && timeLeft < 60 ? 'text-red-600' : 'text-green-600'}`}>
              {timeLeft ? formatTime(timeLeft) : '--:--'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Call Status */}
        <div className="mb-4 text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            callData?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            Status: {callData?.status || 'Connecting...'}
          </span>
        </div>

        {/* Video Containers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
            <div ref={localVideoRef} className="w-full h-full" />
            <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              You
            </div>
          </div>
          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
            <div ref={remoteVideoRef} className="w-full h-full" />
            <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              Remote User
            </div>
          </div>
        </div>

        {/* End Call Button */}
        <div className="mt-4 text-center">
          <button
            onClick={handleCallEnd}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            disabled={isCallEnding}
          >
            {isCallEnding ? 'Ending Call...' : 'End Call'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
