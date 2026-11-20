const user = JSON.parse(localStorage.getItem('foodflow_user') || 'null');
const token = localStorage.getItem('foodflow_token');

if (!user || !token) {
  window.location.href = './login.html';
} else {
  const role = user.role || 'student';
  const roleLabel = document.querySelector('#roleLabel');
  const title = document.querySelector('#dashboardTitle');
  const message = document.querySelector('#dashboardMessage');
  const cards = document.querySelector('#dashboardCards');

  const content = {
    admin: { label: 'ADMIN WORKSPACE', message: 'Oversee your cafeteria operations at a glance.', cards: [['Users', 'Manage accounts and roles'], ['Menu', 'Review today\'s menu'], ['Orders', 'Monitor active orders']] },
    staff: { label: 'STAFF WORKSPACE', message: 'Keep today\'s service moving smoothly.', cards: [['Today\'s orders', 'Prepare and update orders'], ['Menu status', 'Keep items available'], ['Service notes', 'Share important updates']] },
    student: { label: 'STUDENT WORKSPACE', message: 'Find your next meal and follow your orders.', cards: [['Browse menu', 'Explore today\'s options'], ['My orders', 'Track recent orders'], ['Favorites', 'Your saved meals']] }
  }[role] || null;

  if (!content) {
    localStorage.clear();
    window.location.href = './login.html';
  } else {
    roleLabel.textContent = content.label;
    title.textContent = `Hi, ${user.name.split(' ')[0]}.`;
    message.textContent = content.message;
    cards.innerHTML = content.cards.map(([heading, description]) => `<article class="dashboard-card"><span class="card-dot"></span><h2>${heading}</h2><p>${description}</p><span class="card-arrow" aria-hidden="true">&#8594;</span></article>`).join('');
  }
}

document.querySelector('#logoutButton').addEventListener('click', () => {
  localStorage.removeItem('foodflow_token');
  localStorage.removeItem('foodflow_user');
  window.location.href = './login.html';
});
