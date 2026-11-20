const registerForm = document.querySelector('#registerForm');
const registerButton = document.querySelector('#registerButton');
const registerStatus = document.querySelector('#registerStatus');
const passwordInput = document.querySelector('#password');
const confirmPasswordInput = document.querySelector('#confirmPassword');
const API_BASE_URL = window.FOODFLOW_API_BASE_URL;

function passwordsMatch() {
  return passwordInput.value === confirmPasswordInput.value;
}

confirmPasswordInput.addEventListener('input', () => {
  confirmPasswordInput.setCustomValidity(
    passwordsMatch() ? '' : 'Passwords do not match.'
  );
});

passwordInput.addEventListener('input', () => {
  if (confirmPasswordInput.value) {
    confirmPasswordInput.setCustomValidity(
      passwordsMatch() ? '' : 'Passwords do not match.'
    );
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!passwordsMatch()) {
    confirmPasswordInput.setCustomValidity('Passwords do not match.');
    registerStatus.textContent = 'Passwords do not match.';
    registerStatus.className = 'status error';
    confirmPasswordInput.reportValidity();
    confirmPasswordInput.focus();
    return;
  }

  registerButton.disabled = true;
  registerStatus.textContent = 'Creating account...';
  registerStatus.className = 'status';

  const formData = new FormData(registerForm);
  const body = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    gender: formData.get('gender')
  };

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Registration failed.');
    registerStatus.textContent = 'Account created. Taking you to sign in...';
    registerStatus.className = 'status success';
    window.setTimeout(() => { window.location.href = './login.html'; }, 700);
  } catch (error) {
    registerStatus.textContent = error.message;
    registerStatus.className = 'status error';
  } finally {
    registerButton.disabled = false;
  }
});
