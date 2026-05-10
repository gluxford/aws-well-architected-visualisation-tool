// Cognito Authentication Overlay with MFA
// This script adds authentication to the existing page without modifying its functionality

// Cognito configuration - loaded from runtime-config.json via config-loader.js
const COGNITO_CONFIG = window.WA_CONFIG ? {
    UserPoolId: window.WA_CONFIG.userPoolId,
    ClientId: window.WA_CONFIG.clientId,
    Region: window.WA_CONFIG.region
} : {
    UserPoolId: '',
    ClientId: '',
    Region: ''
};

// Initialize Cognito
const poolData = {
    UserPoolId: COGNITO_CONFIG.UserPoolId,
    ClientId: COGNITO_CONFIG.ClientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// Determine email label based on config
function getEmailLabel() {
    if (window.WA_CONFIG && window.WA_CONFIG.emailRestriction && window.WA_CONFIG.emailRestriction.enabled) {
        const domains = window.WA_CONFIG.emailRestriction.allowedDomains || [];
        if (domains.length > 0) {
            return `Email (${domains.map(d => '@' + d).join(', ')} only):`;
        }
    }
    return 'Email:';
}

// Check if email domain is allowed (client-side validation)
function isEmailDomainAllowed(email) {
    if (!window.WA_CONFIG || !window.WA_CONFIG.emailRestriction || !window.WA_CONFIG.emailRestriction.enabled) {
        return true;
    }
    const domains = window.WA_CONFIG.emailRestriction.allowedDomains || [];
    if (domains.length === 0) return true;
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return domains.some(d => d.toLowerCase() === emailDomain);
}

// Create authentication overlay
function createAuthOverlay() {
    const emailLabel = getEmailLabel();
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 90%;">
            <h3 style="text-align: center; margin-bottom: 20px;">AWS Well-Architected Visualizer</h3>
            
            <!-- Sign In Form -->
            <div id="signin-form">
                <h5>Sign In</h5>
                <form id="login-form" style="margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Email:</label>
                        <input type="email" id="auth-email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Password:</label>
                        <input type="password" id="auth-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign In</button>
                </form>
                <p style="text-align: center; margin: 0;">
                    Don't have an account? <a href="#" id="show-signup" style="color: #007bff; text-decoration: none;">Sign up</a>
                </p>
            </div>
            
            <!-- Sign Up Form -->
            <div id="signup-form" style="display: none;">
                <h5>Sign Up</h5>
                <form id="register-form" style="margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label id="signup-email-label" style="display: block; margin-bottom: 5px;">${emailLabel}</label>
                        <input type="email" id="signup-email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Password:</label>
                        <input type="password" id="signup-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign Up</button>
                </form>
                <p style="text-align: center; margin: 0;">
                    Already have an account? <a href="#" id="show-signin" style="color: #007bff; text-decoration: none;">Sign in</a>
                </p>
            </div>
            
            <!-- MFA Setup Form -->
            <div id="mfa-setup-form" style="display: none;">
                <h5>Setup MFA</h5>
                <p style="font-size: 14px; margin-bottom: 15px;">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                <div id="qr-code" style="text-align: center; margin: 15px 0;"></div>
                <p style="font-size: 12px; margin-bottom: 15px;">Or enter this code manually: <code id="secret-code"></code></p>
                <form id="mfa-setup-verify-form">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Enter 6-digit code from your app:</label>
                        <input type="text" id="mfa-code" required maxlength="6" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Verify & Complete Setup</button>
                </form>
            </div>
            
            <!-- MFA Verification Form -->
            <div id="mfa-verify-form" style="display: none;">
                <h5>Enter MFA Code</h5>
                <p style="font-size: 14px; margin-bottom: 15px;">Enter the 6-digit code from your authenticator app:</p>
                <form id="mfa-verify-login-form">
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="mfa-login-code" required maxlength="6" placeholder="000000" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 18px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Verify</button>
                </form>
            </div>
            
            <div id="auth-message" style="margin-top: 15px; padding: 10px; border-radius: 4px; display: none;"></div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('show-signup').onclick = (e) => {
        e.preventDefault();
        showForm('signup-form');
    };
    
    document.getElementById('show-signin').onclick = (e) => {
        e.preventDefault();
        showForm('signin-form');
    };
    
    document.getElementById('login-form').onsubmit = handleSignIn;
    document.getElementById('register-form').onsubmit = handleSignUp;
    document.getElementById('mfa-setup-verify-form').onsubmit = handleMFASetupVerify;
    document.getElementById('mfa-verify-login-form').onsubmit = handleMFAVerify;
}

function showForm(formId) {
    const forms = ['signin-form', 'signup-form', 'mfa-setup-form', 'mfa-verify-form'];
    forms.forEach(id => {
        document.getElementById(id).style.display = id === formId ? 'block' : 'none';
    });
}

let currentCognitoUser = null;

// Authentication handlers
function handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    const authenticationData = {
        Username: email,
        Password: password
    };
    
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const userData = {
        Username: email,
        Pool: userPool
    };
    
    currentCognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    
    currentCognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function(result) {
            removeAuthOverlay();
            addSignOutButton(email);
        },
        onFailure: function(err) {
            showAuthMessage(err.message, 'error');
        },
        mfaRequired: function(challengeName, challengeParameters) {
            showForm('mfa-verify-form');
        },
        totpRequired: function(challengeName, challengeParameters) {
            showForm('mfa-verify-form');
        }
    });
}

function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    // Client-side domain validation
    if (!isEmailDomainAllowed(email)) {
        const domains = window.WA_CONFIG.emailRestriction.allowedDomains || [];
        showAuthMessage(`Only ${domains.map(d => '@' + d).join(', ')} email addresses are allowed`, 'error');
        return;
    }
    
    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        })
    ];
    
    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            showAuthMessage(err.message, 'error');
            return;
        }
        
        currentCognitoUser = result.user;
        
        // Automatically sign in the user after signup
        const authenticationData = {
            Username: email,
            Password: password
        };
        
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        
        currentCognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function(result) {
                // This shouldn't happen with MFA required
            },
            onFailure: function(err) {
                showAuthMessage(err.message, 'error');
            },
            mfaSetup: function(challengeName, challengeParameters) {
                setupMFA();
            },
            totpRequired: function(challengeName, challengeParameters) {
                setupMFA();
            }
        });
    });
}

function setupMFA() {
    currentCognitoUser.associateSoftwareToken({
        onSuccess: function(result) {
            showAuthMessage('Account created! Now setup MFA.', 'success');
            showForm('mfa-setup-form');
        },
        onFailure: function(err) {
            showAuthMessage(err.message, 'error');
        },
        associateSecretCode: function(secretCode) {
            const qrCodeUrl = `otpauth://totp/${encodeURIComponent(currentCognitoUser.getUsername())}?secret=${secretCode}&issuer=${encodeURIComponent('WA Visualizer')}`;
            
            // Generate QR code
            const qrDiv = document.getElementById('qr-code');
            qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code">`;
            
            document.getElementById('secret-code').textContent = secretCode;
        }
    });
}

function handleMFASetupVerify(e) {
    e.preventDefault();
    const code = document.getElementById('mfa-code').value;
    
    currentCognitoUser.verifySoftwareToken(code, 'MFA Setup', {
        onSuccess: function(result) {
            showAuthMessage('MFA setup complete! You can now sign in.', 'success');
            setTimeout(() => {
                showForm('signin-form');
            }, 2000);
        },
        onFailure: function(err) {
            showAuthMessage(err.message, 'error');
        }
    });
}

function handleMFAVerify(e) {
    e.preventDefault();
    const code = document.getElementById('mfa-login-code').value;
    
    currentCognitoUser.sendMFACode(code, {
        onSuccess: function(result) {
            removeAuthOverlay();
            addSignOutButton(currentCognitoUser.getUsername());
        },
        onFailure: function(err) {
            showAuthMessage(err.message, 'error');
        }
    });
}

function showAuthMessage(message, type) {
    const messageDiv = document.getElementById('auth-message');
    messageDiv.style.display = 'block';
    messageDiv.style.backgroundColor = type === 'error' ? '#f8d7da' : '#d4edda';
    messageDiv.style.color = type === 'error' ? '#721c24' : '#155724';
    messageDiv.style.border = `1px solid ${type === 'error' ? '#f5c6cb' : '#c3e6cb'}`;
    messageDiv.textContent = message;
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function removeAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function addSignOutButton(email) {
    // Add a simple sign out button to the existing page
    const signOutDiv = document.createElement('div');
    signOutDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        padding: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
    `;
    signOutDiv.innerHTML = `
        <span style="margin-right: 10px; font-size: 14px;">${email}</span>
        <button onclick="signOut()" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Sign Out</button>
    `;
    document.body.appendChild(signOutDiv);
}

function signOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        cognitoUser.signOut();
    }
    location.reload(); // Simple reload to reset the page
}

// Check authentication on page load
function checkAuthentication() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        cognitoUser.getSession(function(err, session) {
            if (err || !session.isValid()) {
                createAuthOverlay();
            } else {
                addSignOutButton(cognitoUser.getUsername());
            }
        });
    } else {
        createAuthOverlay();
    }
}

// Initialize authentication when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuthentication);
} else {
    checkAuthentication();
}

// Make signOut available globally
window.signOut = signOut;
