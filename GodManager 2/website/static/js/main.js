// Password strength indicators
function checkPasswordStrength(password) {
    const requirements = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    const allMet = Object.values(requirements).every(v => v);
    return { requirements, allMet };
}

// Form validation
function validateForm(formElement) {
    const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

// AJAX username checking
let usernameCheckTimeout;
function checkUsernameAvailability(inputElement, statusElement) {
    const username = inputElement.value.toLowerCase().trim();
    
    clearTimeout(usernameCheckTimeout);
    
    if (username.length < 3) {
        statusElement.textContent = '';
        return;
    }
    
    usernameCheckTimeout = setTimeout(() => {
        fetch(`/check_username?username=${encodeURIComponent(username)}`)
            .then(response => response.json())
            .then(data => {
                if (data.available) {
                    statusElement.innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Username available</span>';
                    inputElement.classList.remove('is-invalid');
                    inputElement.classList.add('is-valid');
                } else {
                    statusElement.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> Username already taken</span>';
                    inputElement.classList.remove('is-valid');
                    inputElement.classList.add('is-invalid');
                }
            })
            .catch(error => {
                console.error('Error checking username:', error);
            });
    }, 300);
}

// Password visibility toggle
function togglePasswordVisibility(buttonElement, inputElement) {
    const icon = buttonElement.querySelector('i');
    if (inputElement.type === 'password') {
        inputElement.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        inputElement.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Modal management
function showModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function hideModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
}

// Username lowercase conversion
function convertToLowercase(inputElement) {
    inputElement.addEventListener('input', function() {
        this.value = this.value.toLowerCase();
    });
}

// Password confirmation validation
function validatePasswordMatch(passwordInput, confirmInput, statusElement) {
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    
    if (confirm.length === 0) {
        statusElement.textContent = '';
        return false;
    }
    
    if (password === confirm) {
        statusElement.innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Passwords match</span>';
        confirmInput.classList.remove('is-invalid');
        confirmInput.classList.add('is-valid');
        return true;
    } else {
        statusElement.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> Passwords do not match</span>';
        confirmInput.classList.remove('is-valid');
        confirmInput.classList.add('is-invalid');
        return false;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
    
    // Initialize username fields to lowercase
    const usernameInputs = document.querySelectorAll('input[name="username"]');
    usernameInputs.forEach(input => {
        convertToLowercase(input);
    });
});

