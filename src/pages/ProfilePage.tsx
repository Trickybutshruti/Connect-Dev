import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface DeveloperProfile {
  displayName: string;
  email: string;
  expertise: string[];
  experience: string;
  hourlyRate: number;
  about: string;
  walletAddress: string;
}

const defaultProfile: DeveloperProfile = {
  displayName: '',
  email: '',
  expertise: [],
  experience: '',
  hourlyRate: 0,
  about: '',
  walletAddress: '',
};

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<DeveloperProfile>(defaultProfile);
  const [newExpertise, setNewExpertise] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'developers', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            displayName: data.displayName || user.displayName || '',
            email: data.email || user.email || '',
            expertise: data.expertise || [],
            experience: data.experience || '',
            hourlyRate: data.hourlyRate || 0,
            about: data.about || '',
            walletAddress: data.walletAddress || '',
          });
        } else {
          // Create initial profile if it doesn't exist
          const initialProfile = {
            ...defaultProfile,
            displayName: user.displayName || '',
            email: user.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(docRef, initialProfile);
          setProfile(initialProfile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'developers', user.uid);
      const data = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, data);

      // Update the user's isNewUser status in the users collection
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        isNewUser: false
      });
      
      setShowSuccess(true);
      // Force navigation to developer dashboard
      window.location.href = '/developer-dashboard';
    } catch (error) {
      console.error('Error saving profile:', error);
      setShowSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  const addExpertise = () => {
    if (newExpertise && !profile.expertise.includes(newExpertise)) {
      setProfile({
        ...profile,
        expertise: [...profile.expertise, newExpertise],
      });
      setNewExpertise('');
    }
  };

  const removeExpertise = (skill: string) => {
    setProfile({
      ...profile,
      expertise: profile.expertise.filter((s) => s !== skill),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please sign in to view this page.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Developer Profile</h1>

          {showSuccess && (
            <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
              Profile saved successfully!
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
                  <input
                    type="text"
                    value={profile.walletAddress}
                    onChange={(e) => setProfile({ ...profile, walletAddress: e.target.value })}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Enter your Celo wallet address to receive payments</p>
                </div>
              </div>
            </div>

            {/* Expertise */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Expertise</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExpertise}
                    onChange={(e) => setNewExpertise(e.target.value)}
                    placeholder="Add a skill (e.g., React, Node.js)"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addExpertise}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                    >
                      {skill}
                      <button
                        onClick={() => removeExpertise(skill)}
                        className="ml-2 text-indigo-600 hover:text-indigo-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Experience */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Experience</h2>
              <textarea
                value={profile.experience}
                onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                rows={4}
                placeholder="Describe your professional experience..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Hourly Rate */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Hourly Rate</h2>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">$</span>
                <input
                  type="number"
                  value={profile.hourlyRate}
                  onChange={(e) => setProfile({ ...profile, hourlyRate: Number(e.target.value) })}
                  min="0"
                  className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-gray-500 ml-2">per hour</span>
              </div>
            </div>

            {/* About */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
              <textarea
                value={profile.about}
                onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                rows={4}
                placeholder="Tell clients about yourself..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            <button
              onClick={() => navigate('/developer-dashboard')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
