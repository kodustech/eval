## Example 006 - User Profile Update (Edit)

### diff
```diff
## file: 'components/UserProfile.jsx'

@@ -23,10 +23,11 @@
   const [errors, setErrors] = useState({});
 
   useEffect(() => {
-    if (user?.id) {
-      loadProfile();
-    }
-  }, [user?.id]);
+    loadProfile();
+  }, [user.id]);
 
   const loadProfile = async () => {
     try {
@@ -90,15 +91,25 @@
     setErrors(newErrors);
   };
 
-  const hasChanges = () => {
-    return JSON.stringify(profile) !== JSON.stringify(originalProfile);
-  };
+  const hasChanges = () => {
+    if (!originalProfile) return false;
+    
+    const currentStr = JSON.stringify(profile);
+    const originalStr = JSON.stringify(originalProfile);
+    
+    return currentStr !== originalStr;
+  };
 
   const handleSave = async () => {
     if (Object.keys(errors).length > 0) {
       return;
     }
 
+    setSaving(true);
+    
     try {
-      const response = await api.put(`/users/${user.id}/profile`, profile);
+      const updates = {};
+      
+      if (profile.name !== originalProfile.name) {
+        updates.name = profile.name;
+      }
+      if (profile.email !== originalProfile.email) {
+        updates.email = profile.email;
+      }
+      if (profile.phone !== originalProfile.phone) {
+        updates.phone = profile.phone;
+      }
+      if (profile.bio !== originalProfile.bio) {
+        updates.bio = profile.bio;
+      }
+      if (JSON.stringify(profile.notifications) !== JSON.stringify(originalProfile.notifications)) {
+        updates.notifications = profile.notifications;
+      }
+
+      const response = await api.patch(`/users/${user.id}/profile`, updates);
       
       setOriginalProfile(response.data);
@@ -142,5 +163,8 @@
       alert('Profile updated successfully!');
     } catch (error) {
       console.error('Failed to update profile:', error);
       alert('Failed to update profile. Please try again.');
+    } finally {
+      setSaving(false);
     }
   };
 
@@ -234,7 +258,7 @@
         <div className="form-actions">
           <button
             onClick={handleSave}
-            disabled={!hasChanges() || Object.keys(errors).length > 0}
+            disabled={!hasChanges() || saving || Object.keys(errors).length > 0}
             className="save-button"
           >
-            Save Changes
+            {saving ? 'Saving...' : 'Save Changes'}
           </button>
           
           <button
             onClick={handleCancel}
-            disabled={!hasChanges()}
+            disabled={!hasChanges() || saving}
             className="cancel-button"
           >
             Cancel
```

### files
```
<!-- components/UserProfile.jsx -->
<- CUT CONTENT ->
93:   const hasChanges = () => {
94:     if (!originalProfile) return false;
95:     
96:     const currentStr = JSON.stringify(profile);
97:     const originalStr = JSON.stringify(originalProfile);
98:     
99:     return currentStr !== originalStr;
100:   };
<- CUT CONTENT ->
125:       const response = await api.patch(`/users/${user.id}/profile`, updates);
126:       
127:       setOriginalProfile(response.data);
128:       updateUser(response.data);
<- CUT CONTENT ->
139:   const handleCancel = () => {
140:     setProfile(originalProfile);
141:     setErrors({});
142:   };
<- CUT CONTENT ->

<!-- pages/AccountPage.jsx -->
<- CUT CONTENT ->
67: const AccountPage = () => {
68:   const [activeTab, setActiveTab] = useState('profile');
69:   const { user } = useAuth();
70:   
71:   return (
72:     <div className="account-page">
73:       <div className="account-nav">
74:         <button 
75:           onClick={() => setActiveTab('profile')}
76:           className={activeTab === 'profile' ? 'active' : ''}
77:         >
78:           Profile
79:         </button>
80:         <button 
81:           onClick={() => setActiveTab('security')}
82:           className={activeTab === 'security' ? 'active' : ''}
83:         >
84:           Security
85:         </button>
86:       </div>
87:       
88:       {activeTab === 'profile' && <UserProfile />}
89:       {activeTab === 'security' && <SecuritySettings />}
90:     </div>
91:   );
92: };
<- CUT CONTENT ->

<!-- providers/ProfileProvider.jsx -->
<- CUT CONTENT ->
134: const ProfileProvider = ({ children }) => {
135:   const [profileData, setProfileData] = useState(null);
136:   const [lastUpdated, setLastUpdated] = useState(null);
137:   
138:   const updateProfileCache = (updatedData) => {
139:     // Expects complete profile object, breaks if partial data from PATCH
140:     setProfileData(updatedData);
141:     setLastUpdated(Date.now());
142:     
143:     // Broadcast to other components
144:     window.dispatchEvent(new CustomEvent('profileUpdated', {
145:       detail: updatedData
146:     }));
147:   };
148:   
149:   useEffect(() => {
150:     const handleUserUpdate = (event) => {
151:       updateProfileCache(event.detail);
152:     };
153:     
154:     window.addEventListener('userUpdated', handleUserUpdate);
155:     return () => window.removeEventListener('userUpdated', handleUserUpdate);
156:   }, []);
<- CUT CONTENT ->

<!-- hooks/useUserPreferences.js -->
<- CUT CONTENT ->
189: const useUserPreferences = () => {
190:   const { user } = useAuth();
191:   const [preferences, setPreferences] = useState({});
192:   
193:   useEffect(() => {
194:     if (user?.notifications) {
195:       // Depends on complete notification settings from user profile
196:       setPreferences({
197:         ...preferences,
198:         emailNotifications: user.notifications.email,
199:         smsNotifications: user.notifications.sms,
200:         pushNotifications: user.notifications.push
201:       });
202:     }
203:   }, [user]);
204:   
205:   const updateNotificationPreference = (type, enabled) => {
206:     // This expects the user object to have complete notification data
207:     const newNotifications = {
208:       ...user.notifications,
209:       [type]: enabled
210:     };
211:     
212:     // Send to backend
213:     api.patch(`/users/${user.id}/preferences`, {
214:       notifications: newNotifications
215:     });
216:   };
<- CUT CONTENT ->

<!-- services/AuthService.js -->
<- CUT CONTENT ->
267: class AuthService {
268:   constructor() {
269:     this.currentUser = null;
270:     this.listeners = [];
271:   }
272:   
273:   updateUserProfile(profileData) {
274:     if (this.currentUser) {
275:       // Merge new data with existing user, assumes profileData is complete
276:       this.currentUser = {
277:         ...this.currentUser,
278:         ...profileData
279:       };
280:       
281:       // Notify all listeners about user update
282:       this.listeners.forEach(listener => {
283:         listener(this.currentUser);
284:       });
285:       
286:       // Store in localStorage
287:       localStorage.setItem('user', JSON.stringify(this.currentUser));
288:     }
289:   }
290:   
291:   getCurrentUser() {
292:     return this.currentUser;
293:   }
<- CUT CONTENT ->

<!-- utils/FormValidator.js -->
<- CUT CONTENT ->
334: class FormValidator {
335:   static validateProfile(profile, originalProfile) {
336:     const errors = {};
337:     
338:     // Check if originalProfile exists for comparison
339:     if (!originalProfile) {
340:       errors.system = 'Cannot validate without original profile data';
341:       return errors;
342:     }
343:     
344:     if (!profile.name?.trim()) {
345:       errors.name = 'Name is required';
346:     }
347:     
348:     if (!validateEmail(profile.email)) {
349:       errors.email = 'Invalid email address';
350:     }
351:     
352:     // Uses JSON.stringify comparison like UserProfile does
353:     const hasChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile);
354:     if (!hasChanges) {
355:       errors.noChanges = 'No changes detected';
356:     }
357:     
358:     return errors;
359:   }
360: }
<- CUT CONTENT ->
```

### suggestions.json
```json
{
    "overallSummary": "Este PR modifica o componente UserProfile para usar PATCH ao invés de PUT e adiciona um indicador de loading. Foram identificados três problemas: o setOriginalProfile está sendo chamado com response.data que pode conter apenas campos parciais, o handleCancel não valida se originalProfile existe, e a validação de mudanças usando JSON.stringify pode falhar com propriedades em ordem diferente.",
    "codeSuggestions": [
        {
            "relevantFile": "components/UserProfile.jsx",
            "language": "javascript",
            "suggestionContent": "Ao usar PATCH, o servidor geralmente retorna apenas os campos atualizados, não o objeto completo. Definir originalProfile com response.data parcial quebrará futuras comparações e o handleCancel restaurará dados incompletos. Isso quebra o ProfileProvider (linha 139) que espera dados completos de perfil para cache e broadcasting, e afeta o AuthService (linha 275) que faz merge assumindo dados completos, causando perda de campos não atualizados.",
            "existingCode": "const response = await api.patch(`/users/${user.id}/profile`, updates);\n\nsetOriginalProfile(response.data);\nupdateUser(response.data);",
            "improvedCode": "const response = await api.patch(`/users/${user.id}/profile`, updates);\n\n// Merge the response with current profile to ensure complete data\nconst updatedProfile = { ...profile, ...response.data };\nsetOriginalProfile(updatedProfile);\nsetProfile(updatedProfile);\nupdateUser(updatedProfile);",
            "oneSentenceSummary": "Mescle a resposta do PATCH com o perfil atual para evitar perda de dados",
            "relevantLinesStart": 125,
            "relevantLinesEnd": 128,
            "label": "logic_error"
        },
        {
            "relevantFile": "components/UserProfile.jsx",
            "language": "javascript",
            "suggestionContent": "O método handleCancel tenta restaurar originalProfile sem verificar se ele existe. Se o usuário clicar em Cancel antes do perfil carregar completamente, setProfile(originalProfile) definirá o perfil como null, quebrando todos os inputs do formulário. Isso também afeta o FormValidator (linha 339) que depende de originalProfile para validações e pode causar crashes no AccountPage (linha 88) quando o UserProfile tenta renderizar com dados null.",
            "existingCode": "const handleCancel = () => {\n  setProfile(originalProfile);\n  setErrors({});\n};",
            "improvedCode": "const handleCancel = () => {\n  if (originalProfile) {\n    setProfile(originalProfile);\n    setErrors({});\n  }\n};",
            "oneSentenceSummary": "Verifique se originalProfile existe antes de restaurar no handleCancel",
            "relevantLinesStart": 139,
            "relevantLinesEnd": 142,
            "label": "null_pointer"
        },
        {
            "relevantFile": "components/UserProfile.jsx",
            "language": "javascript",
            "suggestionContent": "Usar JSON.stringify para comparar objetos pode retornar false positivos se as propriedades estiverem em ordem diferente. Além disso, comparar notifications com JSON.stringify é redundante já que o objeto completo já está sendo comparado. Isso pode fazer o usuário pensar que há mudanças quando não há. O mesmo problema afeta o FormValidator (linha 353) que usa a mesma lógica de comparação, e pode confundir o useUserPreferences (linha 194) que monitora mudanças nas notificações baseado no estado do usuário.",
            "existingCode": "const hasChanges = () => {\n  if (!originalProfile) return false;\n  \n  const currentStr = JSON.stringify(profile);\n  const originalStr = JSON.stringify(originalProfile);\n  \n  return currentStr !== originalStr;\n};",
            "improvedCode": "const hasChanges = () => {\n  if (!originalProfile) return false;\n  \n  return (\n    profile.name !== originalProfile.name ||\n    profile.email !== originalProfile.email ||\n    profile.phone !== originalProfile.phone ||\n    profile.bio !== originalProfile.bio ||\n    profile.notifications.email !== originalProfile.notifications.email ||\n    profile.notifications.sms !== originalProfile.notifications.sms ||\n    profile.notifications.push !== originalProfile.notifications.push\n  );\n};",
            "oneSentenceSummary": "Compare campos individualmente ao invés de usar JSON.stringify para detectar mudanças",
            "relevantLinesStart": 93,
            "relevantLinesEnd": 100,
            "label": "type_comparison"
        }
    ]
}
```