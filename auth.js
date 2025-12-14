document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');

    // Toggle password visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    // Check if user is already logged in
    checkSession();

    async function checkSession() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.loggedIn) {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        // Show loading state
        loginButton.disabled = true;
        buttonText.textContent = 'Signing in...';
        loadingSpinner.style.display = 'inline-block';
        errorMessage.classList.remove('show');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include' // Important for sessions
            });

            const data = await response.json();

            if (response.ok) {
                // Redirect to dashboard
                window.location.href = '/dashboard';
            } else {
                showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please try again.');
        } finally {
            // Reset button state
            loginButton.disabled = false;
            buttonText.textContent = 'Sign In';
            loadingSpinner.style.display = 'none';
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    // Demo account auto-fill
    document.querySelectorAll('.demo-account').forEach(account => {
        account.addEventListener('click', () => {
            const email = account.querySelector('.email').textContent;
            const password = account.querySelector('.password').textContent;
            
            emailInput.value = email;
            passwordInput.value = password;
            
            // Remove error message if showing
            errorMessage.classList.remove('show');
        });
    });
});