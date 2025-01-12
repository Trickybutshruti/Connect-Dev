import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import web3Service from '../services/web3Service';
import PaymentModal from '../components/PaymentModal';

interface Developer {
  id: string;
  displayName: string;
  email: string;
  expertise: string[];
  experience: string;
  hourlyRate: number;
  about: string;
  isOnline: boolean;
  walletAddress: string;
}

interface CallStatus {
  id: string;
  developerId: string;
  status: 'paid' | 'pending' | 'accepted' | 'rejected' | 'active' | 'completed';
  duration?: number;
  totalAmount?: number;
  transactionHash?: string;
  callId?: string;
}

interface BookingModalProps {
  developer: Developer;
  onClose: () => void;
  onConfirm: (duration: number, amount: number) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ developer, onClose, onConfirm }) => {
  const [hours, setHours] = useState<string>('0');
  const [minutes, setMinutes] = useState<string>('0');

  const calculateAmount = (): number => {
    const hoursNum = hours === '' ? 0 : parseInt(hours);
    const minutesNum = minutes === '' ? 0 : parseInt(minutes);
    const totalMinutes = (hoursNum * 60) + minutesNum;
    return (developer.hourlyRate / 60) * totalMinutes;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = hours === '' ? 0 : parseInt(hours);
    const minutesNum = minutes === '' ? 0 : parseInt(minutes);
    const totalMinutes = (hoursNum * 60) + minutesNum;
    const totalAmount = calculateAmount();
    
    if (totalMinutes <= 0) {
      alert('Please enter a valid duration');
      return;
    }

    onConfirm(totalMinutes, totalAmount);
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
      setHours(value);
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) < 60)) {
      setMinutes(value);
    }
  };

  const amount = calculateAmount();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Book Video Call with {developer.displayName}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Duration</label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={hours}
                  onChange={handleHoursChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Hours"
                />
                <span className="text-sm text-gray-500">Hours</span>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={minutes}
                  onChange={handleMinutesChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minutes"
                />
                <span className="text-sm text-gray-500">Minutes</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-700">
              <p>Rate: {developer.hourlyRate} CELO/hour</p>
              <p className="mt-1">Total Duration: {hours} hours {minutes} minutes</p>
              <p className="font-semibold mt-1">Total Amount: {amount.toFixed(2)} CELO</p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Proceed to Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ClientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpertise, setSelectedExpertise] = useState<string>('');
  const [maxRate, setMaxRate] = useState<number>(1000);
  const [activeCall, setActiveCall] = useState<CallStatus | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    // Real-time listener for online developers
    const developersRef = collection(db, 'developers');
    const q = query(developersRef, where('isOnline', '==', true));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const devs: Developer[] = [];
        snapshot.forEach((doc) => {
          // Only add developers who are not the current user
          if (doc.id !== user.uid) {
            devs.push({ id: doc.id, ...doc.data() } as Developer);
          }
        });
        setDevelopers(devs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching developers:', error);
        setLoading(false);
      }
    );

    // Listen for active call status
    if (activeCall?.id) {
      const callRef = doc(db, 'calls', activeCall.id);
      const callUnsubscribe = onSnapshot(callRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'accepted') {
            navigate(`/video-call/${activeCall.id}`);
          } else if (data.status === 'rejected') {
            alert('Call was rejected by the developer');
            setActiveCall(null);
          }
        }
      });

      return () => {
        unsubscribe();
        callUnsubscribe();
      };
    }

    return () => unsubscribe();
  }, [user, navigate, activeCall]);

  const initiateCall = async (developer: Developer) => {
    if (!user) return;

    try {
      const callsRef = collection(db, 'calls');
      const callDoc = await addDoc(callsRef, {
        clientId: user.uid,
        clientName: user.displayName || user.email,
        developerId: developer.id,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      setActiveCall({
        id: callDoc.id,
        developerId: developer.id,
        status: 'pending'
      });
    } catch (error) {
      console.error('Error initiating call:', error);
    }
  };

  const handleBooking = (developer: Developer) => {
    setSelectedDeveloper(developer);
    setShowBookingModal(true);
  };

  const handleBookingConfirm = async (duration: number, amount: number) => {
    if (!user || !selectedDeveloper) return;
    
    // Generate callId here so it's consistent
    const callId = `${user.uid}_${selectedDeveloper.id}_${Date.now()}`;
    
    setSelectedDuration(duration);
    setSelectedAmount(amount);
    setShowBookingModal(false);
    
    // Store callId in state
    setActiveCall({
      id: '', // Will be set after Firestore doc is created
      developerId: selectedDeveloper.id,
      status: 'pending',
      duration: duration,
      totalAmount: amount,
      callId: callId
    });
    
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async (transactionHash: string) => {
    if (!user || !selectedDeveloper || !activeCall?.callId) return;

    try {
      // Create call document in Firestore
      const callsRef = collection(db, 'calls');
      const callDoc = await addDoc(callsRef, {
        clientId: user.uid,
        clientName: user.displayName || user.email,
        developerId: selectedDeveloper.id,
        status: 'paid',
        timestamp: new Date().toISOString(),
        duration: selectedDuration,
        totalAmount: selectedAmount,
        transactionHash: transactionHash,
        callId: activeCall.callId,
        walletAddress: selectedDeveloper.walletAddress
      });

      const newCallStatus: CallStatus = {
        id: callDoc.id,
        developerId: selectedDeveloper.id,
        status: 'paid',
        duration: selectedDuration,
        totalAmount: selectedAmount,
        transactionHash: transactionHash,
        callId: activeCall.callId
      };
      
      setActiveCall(newCallStatus);
      setShowPaymentModal(false);
      setSelectedDeveloper(null);

      // Listen for call status changes
      const callRef = doc(db, 'calls', callDoc.id);
      const unsubscribe = onSnapshot(callRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.status === 'accepted') {
            // Navigate to video call when developer accepts
            navigate(`/video-call/${callDoc.id}`);
            unsubscribe();
          }
        }
      });
    } catch (error) {
      console.error('Error creating call:', error);
      throw error; // Re-throw to be caught by the payment modal
    }
  };

  const handleStartCall = async () => {
    if (!activeCall) return;

    try {
      const callRef = doc(db, 'calls', activeCall.id);
      
      // Update call status to pending
      await updateDoc(callRef, {
        status: 'pending',
        startRequestTime: new Date().toISOString()
      });

      // Wait for developer to accept
      const unsubscribe = onSnapshot(callRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'accepted') {
          // Update status to active
          updateDoc(callRef, {
            status: 'active',
            startTime: new Date().toISOString()
          }).then(() => {
            // Navigate to video call
            navigate(`/video-call/${activeCall.id}`);
          });
          unsubscribe();
        }
      });

      console.log('Waiting for developer to accept call...');
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const handlePayment = async () => {
    if (!selectedDeveloper || !selectedDuration || !selectedAmount || !user) {
      console.error('Missing required payment details');
      return;
    }

    try {
      console.log('Creating call with details:', {
        developer: selectedDeveloper,
        duration: selectedDuration,
        amount: selectedAmount
      });

      // Create the call in the smart contract first
      console.log('Creating call in smart contract...');
      const txHash = await web3Service.createCall(
        activeCall?.callId || '',
        selectedDeveloper.walletAddress,
        selectedDuration,
        selectedAmount.toString() // Convert to string for Web3
      );

      console.log('Call created in smart contract:', {
        txHash,
        callId: activeCall?.callId
      });

      // Handle successful payment
      await handlePaymentComplete(txHash);
    } catch (error: any) {
      console.error('Payment error:', error);
      throw error;
    }
  };

  const filteredDevelopers = developers.filter((dev) => {
    const matchesExpertise = !selectedExpertise || 
      dev.expertise?.some(skill => 
        skill.toLowerCase().includes(selectedExpertise.toLowerCase())
      );
    const matchesRate = !maxRate || (dev.hourlyRate || 0) <= maxRate;
    return matchesExpertise && matchesRate;
  });

  const allExpertise = Array.from(
    new Set(
      developers.flatMap((dev) => dev.expertise || [])
    )
  ).sort();

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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Available Developers</h1>

          {/* Filters */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Expertise
              </label>
              <select
                value={selectedExpertise}
                onChange={(e) => setSelectedExpertise(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All Skills</option>
                {allExpertise.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Hourly Rate ($)
              </label>
              <input
                type="number"
                value={maxRate}
                onChange={(e) => setMaxRate(Number(e.target.value))}
                min="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Developer List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDevelopers.map((developer) => (
              <div
                key={developer.id}
                className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {developer.displayName || developer.email}
                    </h3>
                    <div className={`w-3 h-3 rounded-full ${developer.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500">Hourly Rate</p>
                    <p className="text-lg font-semibold text-indigo-600">${developer.hourlyRate}/hr</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Expertise</p>
                    <div className="flex flex-wrap gap-2">
                      {developer.expertise?.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Experience</p>
                    <p className="text-sm text-gray-600 line-clamp-3">{developer.experience}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">About</p>
                    <p className="text-sm text-gray-600 line-clamp-3">{developer.about}</p>
                  </div>

                  <button
                    onClick={() => handleBooking(developer)}
                    disabled={!!activeCall}
                    className={`w-full px-4 py-2 rounded-md text-white ${
                      activeCall
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredDevelopers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No developers found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {showBookingModal && selectedDeveloper && (
        <BookingModal
          developer={selectedDeveloper}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedDeveloper(null);
          }}
          onConfirm={handleBookingConfirm}
        />
      )}

      {showPaymentModal && selectedDeveloper && activeCall && (
        <PaymentModal
          callId={activeCall.callId || ''}
          developer={selectedDeveloper}
          duration={selectedDuration}
          amount={selectedAmount}
          onClose={() => setShowPaymentModal(false)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {activeCall && activeCall.status === 'paid' && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
          <p className="text-sm text-gray-600 mb-4">
            You can now start the call. The developer will be notified to join once you click "Start Call".
          </p>
          <button
            onClick={handleStartCall}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start Call
          </button>
        </div>
      )}

      {activeCall && activeCall.status === 'pending' && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Waiting for Developer</h3>
          <p className="text-sm text-gray-600">
            Please wait while the developer accepts your call request...
          </p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
