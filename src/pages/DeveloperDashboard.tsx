import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface DeveloperStatus {
  isOnline: boolean;
  hourlyRate: number;
}

interface CallRequest {
  id: string;
  clientId: string;
  clientName: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected' | 'paid';
}

const DeveloperDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeveloperStatus>({ isOnline: false, hourlyRate: 0 });
  const [showRatePrompt, setShowRatePrompt] = useState(false);
  const [newRate, setNewRate] = useState<number>(0);
  const [callRequests, setCallRequests] = useState<CallRequest[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    // Real-time listener for developer status
    const developerRef = doc(db, 'developers', user.uid);
    const unsubscribe = onSnapshot(developerRef, 
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setStatus({
            isOnline: data.isOnline || false,
            hourlyRate: data.hourlyRate || 0
          });
          setNewRate(data.hourlyRate || 0);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching developer status:', error);
        setLoading(false);
      }
    );

    // Listen for call requests
    const callsRef = collection(db, 'calls');
    const callsQuery = query(
      callsRef,
      where('developerId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const callsUnsubscribe = onSnapshot(callsQuery, (snapshot) => {
      const requests: CallRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          timestamp: data.timestamp,
          status: data.status
        });
      });
      setCallRequests(requests.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    });

    return () => {
      unsubscribe();
      callsUnsubscribe();
    };
  }, [user, navigate]);

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;

    try {
      const developerRef = doc(db, 'developers', user.uid);
      const developerDoc = await getDoc(developerRef);

      if (developerDoc.exists()) {
        if (isOnline) {
          setShowRatePrompt(true);
          return;
        }

        await updateDoc(developerRef, {
          isOnline,
          lastStatusUpdate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  const handleRateSubmit = async () => {
    if (!user || newRate <= 0) return;

    try {
      const developerRef = doc(db, 'developers', user.uid);
      await updateDoc(developerRef, {
        hourlyRate: newRate,
        isOnline: true,
        lastStatusUpdate: new Date().toISOString()
      });
      setShowRatePrompt(false);
    } catch (error) {
      console.error('Error updating hourly rate:', error);
    }
  };

  const handleAcceptCall = async (callId: string) => {
    if (!user) return;

    try {
      const callRef = doc(db, 'calls', callId);
      const callDoc = await getDoc(callRef);
      
      if (!callDoc.exists()) {
        console.error('Call not found');
        return;
      }

      // Update call status to accepted
      await updateDoc(callRef, {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedBy: user.uid
      });

      // Wait for client to start call
      const unsubscribe = onSnapshot(callRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'active') {
          // Navigate to video call
          navigate(`/video-call/${callId}`);
          unsubscribe();
        }
      });

      console.log('Waiting for client to start call...');
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleDeclineCall = async (callId: string) => {
    if (!user) return;

    try {
      const callRef = doc(db, 'calls', callId);
      await updateDoc(callRef, {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: user.uid
      });
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Developer Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/profile')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Edit Profile
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Status:</span>
                <button
                  onClick={() => updateOnlineStatus(!status.isOnline)}
                  className={`px-4 py-2 rounded-md ${
                    status.isOnline
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  } text-white`}
                >
                  {status.isOnline ? 'Online' : 'Offline'}
                </button>
              </div>
            </div>
          </div>

          {/* Current Rate Display */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Hourly Rate</h2>
                <p className="text-2xl font-bold text-indigo-600">${status.hourlyRate}/hr</p>
              </div>
              <button
                onClick={() => setShowRatePrompt(true)}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
              >
                Change Rate
              </button>
            </div>
          </div>

          {/* Call Requests */}
          {callRequests.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Incoming Call Requests</h2>
              <div className="space-y-4">
                {callRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{request.clientName}</p>
                      <p className="text-sm text-gray-500">
                        Requested: {new Date(request.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptCall(request.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineCall(request.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rate Prompt Modal */}
          {showRatePrompt && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {status.isOnline ? 'Update Your Hourly Rate' : 'Set Your Hourly Rate'}
                </h2>
                <p className="text-gray-600 mb-4">
                  {status.isOnline
                    ? 'Update your hourly rate. This will be visible to clients.'
                    : 'Please set your hourly rate before going online. You can change this later.'}
                </p>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-gray-600">$</span>
                  <input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(Number(e.target.value))}
                    min="0"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-gray-600">/hr</span>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowRatePrompt(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRateSubmit}
                    disabled={newRate <= 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {status.isOnline ? 'Update Rate' : 'Save & Go Online'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeveloperDashboard;
