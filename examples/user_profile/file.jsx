import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { validateEmail, validatePhone } from '../utils/validators';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    notifications: {
      email: true,
      sms: false,
      push: true
    }
  });
  const [originalProfile, setOriginalProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadProfile();
  }, [user.id]);

  const loadProfile = async () => {
    try {
      const response = await api.get(`/users/${user.id}/profile`);
      setProfile(response.data);
      setOriginalProfile(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
    
    validateField(field, value);
  };

  const handleNotificationChange = (type, enabled) => {
    setProfile(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: enabled
      }
    }));
  };

  const validateField = (field, value) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'email':
        if (!validateEmail(value)) {
          newErrors.email = 'Invalid email address';
        } else {
          delete newErrors.email;
        }
        break;
        
      case 'phone':
        if (value && !validatePhone(value)) {
          newErrors.phone = 'Invalid phone number';
        } else {
          delete newErrors.phone;
        }
        break;
        
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'Name is required';
        } else {
          delete newErrors.name;
        }
        break;
    }
    
    setErrors(newErrors);
  };

  const hasChanges = () => {
    if (!originalProfile) return false;
    
    const currentStr = JSON.stringify(profile);
    const originalStr = JSON.stringify(originalProfile);
    
    return currentStr !== originalStr;
  };

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    
    try {
      const updates = {};
      
      if (profile.name !== originalProfile.name) {
        updates.name = profile.name;
      }
      if (profile.email !== originalProfile.email) {
        updates.email = profile.email;
      }
      if (profile.phone !== originalProfile.phone) {
        updates.phone = profile.phone;
      }
      if (profile.bio !== originalProfile.bio) {
        updates.bio = profile.bio;
      }
      if (JSON.stringify(profile.notifications) !== JSON.stringify(originalProfile.notifications)) {
        updates.notifications = profile.notifications;
      }

      const response = await api.patch(`/users/${user.id}/profile`, updates);
      
      setOriginalProfile(response.data);
      updateUser(response.data);
      
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(originalProfile);
    setErrors({});
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="user-profile">
      <h2>My Profile</h2>
      
      <div className="profile-form">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Phone (optional)</label>
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={errors.phone ? 'error' : ''}
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            rows={4}
          />
        </div>

        <div className="notification-settings">
          <h3>Notification Preferences</h3>
          
          <label>
            <input
              type="checkbox"
              checked={profile.notifications.email}
              onChange={(e) => handleNotificationChange('email', e.target.checked)}
            />
            Email notifications
          </label>

          <label>
            <input
              type="checkbox"
              checked={profile.notifications.sms}
              onChange={(e) => handleNotificationChange('sms', e.target.checked)}
            />
            SMS notifications
          </label>

          <label>
            <input
              type="checkbox"
              checked={profile.notifications.push}
              onChange={(e) => handleNotificationChange('push', e.target.checked)}
            />
            Push notifications
          </label>
        </div>

        <div className="form-actions">
          <button
            onClick={handleSave}
            disabled={!hasChanges() || saving || Object.keys(errors).length > 0}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            onClick={handleCancel}
            disabled={!hasChanges() || saving}
            className="cancel-button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 