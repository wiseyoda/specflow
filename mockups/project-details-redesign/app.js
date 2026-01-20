// ========================================
// Project Details Redesign - Interactivity
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initDemoControls();
  initTabs();
  initDropdowns();
  initModals();
  initTaskCards();
  initPhaseToggle();
  initSessionHistory();
});

// ========================================
// Demo Controls
// ========================================

function initDemoControls() {
  const workflowStateSelect = document.getElementById('workflow-state');
  const healthStateSelect = document.getElementById('health-state');

  workflowStateSelect.addEventListener('change', (e) => {
    updateWorkflowState(e.target.value);
  });

  healthStateSelect.addEventListener('change', (e) => {
    updateHealthState(e.target.value);
  });
}

function updateWorkflowState(state) {
  // Update header status indicator
  const headerStatus = document.getElementById('header-status');
  const statusDot = headerStatus.querySelector('.status-dot');
  const statusText = headerStatus.querySelector('.status-text');

  statusDot.className = 'status-dot ' + state;

  const stateLabels = {
    idle: 'Idle',
    running: 'Running',
    waiting: 'Waiting',
    completed: 'Completed',
    failed: 'Failed'
  };
  statusText.textContent = stateLabels[state];

  // Update step status in phase card
  const stepStatus = document.getElementById('step-status');
  stepStatus.innerHTML = `
    <span class="status-dot ${state}"></span>
    ${stateLabels[state]}
  `;

  // Update Overview tab Quick Action
  const actionStates = ['idle', 'running', 'waiting', 'completed', 'failed'];
  actionStates.forEach(s => {
    const el = document.getElementById(`action-${s}`);
    if (el) el.style.display = s === state ? 'flex' : 'none';
  });

  // Update alert bar
  const alertBar = document.getElementById('alert-bar');
  if (state === 'failed') {
    alertBar.style.display = 'flex';
    alertBar.className = 'alert-bar error';
    alertBar.querySelector('.alert-message').textContent =
      'Workflow failed: Connection timeout. Check logs for details.';
  } else {
    alertBar.style.display = 'none';
  }

  // Update Workflow tab header
  const wfHeaderStates = {
    idle: 'wf-header-idle',
    running: 'wf-header-active',
    waiting: 'wf-header-waiting',
    completed: 'wf-header-idle',
    failed: 'wf-header-idle'
  };

  document.getElementById('wf-header-idle').style.display =
    ['idle', 'completed', 'failed'].includes(state) ? 'flex' : 'none';
  document.getElementById('wf-header-active').style.display =
    state === 'running' ? 'flex' : 'none';
  document.getElementById('wf-header-waiting').style.display =
    state === 'waiting' ? 'flex' : 'none';

  // Update live indicator
  const liveIndicator = document.getElementById('live-indicator');
  liveIndicator.style.display = state === 'running' ? 'flex' : 'none';

  // Update typing indicator
  const typingIndicator = document.getElementById('typing-indicator');
  typingIndicator.style.display = state === 'running' ? 'block' : 'none';

  // Update follow-up input visibility
  const followUpInput = document.getElementById('follow-up-input');
  followUpInput.style.display = ['idle', 'completed', 'failed'].includes(state) ? 'flex' : 'none';

  // Auto-show question modal when waiting
  if (state === 'waiting') {
    setTimeout(() => {
      document.getElementById('question-modal').style.display = 'flex';
    }, 500);
  }
}

function updateHealthState(state) {
  const healthDisplay = document.getElementById('health-display');
  const healthIcon = healthDisplay.querySelector('.health-icon');
  const healthText = healthDisplay.querySelector('.health-text');

  healthIcon.className = 'health-icon ' + state;

  const stateConfig = {
    healthy: { icon: '✓', text: 'Healthy' },
    warning: { icon: '!', text: 'Warning' },
    error: { icon: '✕', text: 'Error' }
  };

  healthIcon.textContent = stateConfig[state].icon;
  healthText.textContent = stateConfig[state].text;

  // Update alert bar for warning state
  const alertBar = document.getElementById('alert-bar');
  if (state === 'warning') {
    alertBar.style.display = 'flex';
    alertBar.className = 'alert-bar warning';
    alertBar.querySelector('.alert-message').textContent =
      'Step has been in progress for over 5 minutes. Consider checking status.';
  } else if (state !== 'error' && document.getElementById('workflow-state').value !== 'failed') {
    alertBar.style.display = 'none';
  }
}

// ========================================
// Tab Navigation
// ========================================

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Handle card links that switch tabs
  document.querySelectorAll('[data-tab]').forEach(link => {
    if (link.classList.contains('tab-btn')) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabId}-tab`);
  });
}

// ========================================
// Dropdowns
// ========================================

function initDropdowns() {
  // Start Workflow dropdown
  const startWorkflowBtn = document.getElementById('start-workflow-btn');
  const workflowDropdown = document.getElementById('workflow-dropdown');

  startWorkflowBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    workflowDropdown.classList.toggle('show');
  });

  // Next Workflow dropdown (reuses same structure)
  const nextWorkflowBtn = document.getElementById('next-workflow-btn');
  nextWorkflowBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    workflowDropdown.classList.toggle('show');
  });

  // Actions menu dropdown
  const actionsMenuBtn = document.getElementById('actions-menu-btn');
  const actionsDropdown = document.getElementById('actions-dropdown');

  actionsMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsDropdown.classList.toggle('show');
  });

  // Workflow skill selection
  workflowDropdown?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const skill = item.dataset.skill;
      workflowDropdown.classList.remove('show');
      showConfirmModal(skill);
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    workflowDropdown?.classList.remove('show');
    actionsDropdown?.classList.remove('show');
  });
}

// ========================================
// Modals
// ========================================

function initModals() {
  // Question modal
  const questionModal = document.getElementById('question-modal');
  const answerQuestionsBtn = document.getElementById('answer-questions-btn');
  const wfAnswerBtn = document.getElementById('wf-answer-btn');

  answerQuestionsBtn?.addEventListener('click', () => {
    questionModal.style.display = 'flex';
  });

  wfAnswerBtn?.addEventListener('click', () => {
    questionModal.style.display = 'flex';
  });

  // Question modal navigation
  const prevBtn = document.getElementById('prev-question');
  const nextBtn = document.getElementById('next-question');
  const submitBtn = document.getElementById('submit-answers');
  const progressText = questionModal?.querySelector('.question-progress');

  let currentQuestion = 1;
  const totalQuestions = 2;

  function updateQuestionNav() {
    progressText.textContent = `Question ${currentQuestion} of ${totalQuestions}`;
    prevBtn.disabled = currentQuestion === 1;

    if (currentQuestion === totalQuestions) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    }
  }

  prevBtn?.addEventListener('click', () => {
    if (currentQuestion > 1) {
      currentQuestion--;
      updateQuestionNav();
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (currentQuestion < totalQuestions) {
      currentQuestion++;
      updateQuestionNav();
    }
  });

  submitBtn?.addEventListener('click', () => {
    questionModal.style.display = 'none';
    currentQuestion = 1;
    updateQuestionNav();

    // Simulate workflow resuming
    document.getElementById('workflow-state').value = 'running';
    updateWorkflowState('running');
  });

  // "Other" option shows custom input
  document.querySelectorAll('.option-item input[value="other"]').forEach(input => {
    input.addEventListener('change', () => {
      const customInput = document.getElementById('custom-q1');
      customInput.style.display = input.checked ? 'block' : 'none';
    });
  });

  // Follow-up checkbox
  const addFollowUp = document.getElementById('add-follow-up');
  const followUpText = document.getElementById('follow-up-modal-text');

  addFollowUp?.addEventListener('change', () => {
    followUpText.style.display = addFollowUp.checked ? 'block' : 'none';
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.parentElement.style.display = 'none';
    });
  });
}

function showConfirmModal(skill) {
  const modal = document.getElementById('confirm-modal');
  const skillName = document.getElementById('confirm-skill');
  const description = document.getElementById('confirm-description');

  const skillDescriptions = {
    orchestrate: 'This will run the end-to-end phase execution workflow.',
    merge: 'This will close the current phase and merge changes to main.',
    design: 'This will create spec.md, plan.md, and tasks for the current phase.',
    implement: 'This will execute tasks using test-driven development.',
    verify: 'This will verify completion and update the roadmap.'
  };

  skillName.textContent = skill.charAt(0).toUpperCase() + skill.slice(1);
  description.textContent = skillDescriptions[skill] || 'This will start the selected workflow.';

  modal.style.display = 'flex';
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

function startWorkflow() {
  closeConfirmModal();

  // Simulate workflow starting
  document.getElementById('workflow-state').value = 'running';
  updateWorkflowState('running');

  // Switch to workflow tab
  switchTab('workflow');
}

// Make functions globally available
window.switchTab = switchTab;
window.closeConfirmModal = closeConfirmModal;
window.startWorkflow = startWorkflow;

// ========================================
// Task Cards
// ========================================

function initTaskCards() {
  const taskCards = document.querySelectorAll('.task-card:not(.completed)');
  const taskDetail = document.getElementById('task-detail');

  taskCards.forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.task;
      const taskTitle = card.querySelector('.task-title').textContent;

      document.querySelector('.detail-task-id').textContent = taskId;
      document.querySelector('.detail-header h3').innerHTML =
        `<span class="detail-task-id">${taskId}</span> ${taskTitle}`;

      taskDetail.style.display = 'block';
    });
  });

  // Collapse done column
  const collapseBtn = document.getElementById('collapse-done');
  const doneTasks = document.getElementById('done-tasks');
  let collapsed = false;

  collapseBtn?.addEventListener('click', () => {
    collapsed = !collapsed;
    doneTasks.style.display = collapsed ? 'none' : 'flex';
    collapseBtn.querySelector('svg').style.transform = collapsed ? 'rotate(-90deg)' : '';
  });
}

function closeTaskDetail() {
  document.getElementById('task-detail').style.display = 'none';
}

window.closeTaskDetail = closeTaskDetail;

// ========================================
// Phase Timeline Toggle
// ========================================

function initPhaseToggle() {
  // Already handled by onclick in HTML
}

function togglePhase(header) {
  const item = header.closest('.phase-item');
  const body = item.querySelector('.phase-card-body');

  if (item.classList.contains('expanded')) {
    item.classList.remove('expanded');
    body.style.display = 'none';
  } else {
    item.classList.add('expanded');
    body.style.display = 'block';
  }
}

window.togglePhase = togglePhase;

// ========================================
// Session History
// ========================================

function initSessionHistory() {
  const historyItems = document.querySelectorAll('.history-item');

  historyItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all items
      historyItems.forEach(i => i.classList.remove('active'));

      // Add active class to clicked item
      item.classList.add('active');

      // Simulate loading session messages
      const skill = item.querySelector('.history-skill').textContent;
      const sessionId = item.querySelector('.history-id').textContent;

      // Update viewer header info
      const wfSkill = document.querySelector('.wf-skill');
      const wfSessionId = document.querySelector('.wf-session-id');
      if (wfSkill) wfSkill.textContent = skill;
      if (wfSessionId) wfSessionId.textContent = `Session: ${sessionId}`;

      // Show follow-up input for historical sessions
      const followUpInput = document.getElementById('follow-up-input');
      if (!item.querySelector('.badge.running')) {
        followUpInput.style.display = 'flex';
      }
    });
  });

  // Follow-up message sending
  const sendFollowUp = document.getElementById('send-follow-up');
  const followUpText = document.getElementById('follow-up-text');

  sendFollowUp?.addEventListener('click', () => {
    const message = followUpText.value.trim();
    if (!message) return;

    // Add message to feed
    const messageFeed = document.getElementById('message-feed');
    const newMessage = document.createElement('div');
    newMessage.className = 'message user';
    newMessage.innerHTML = `
      <div class="message-role">You</div>
      <div class="message-content">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    messageFeed.insertBefore(newMessage, document.getElementById('typing-indicator'));

    // Clear input
    followUpText.value = '';

    // Simulate workflow resuming
    document.getElementById('workflow-state').value = 'running';
    updateWorkflowState('running');

    // Scroll to bottom
    messageFeed.scrollTop = messageFeed.scrollHeight;
  });
}

// ========================================
// Utilities
// ========================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// Auto-scroll for message feed
// ========================================

const autoScrollBtn = document.getElementById('auto-scroll-btn');
let autoScrollEnabled = true;

autoScrollBtn?.addEventListener('click', () => {
  autoScrollEnabled = !autoScrollEnabled;
  autoScrollBtn.textContent = `Auto-scroll: ${autoScrollEnabled ? 'ON' : 'OFF'}`;
});

// Detect manual scroll
const messageFeed = document.getElementById('message-feed');
messageFeed?.addEventListener('scroll', () => {
  const isAtBottom = messageFeed.scrollHeight - messageFeed.scrollTop <= messageFeed.clientHeight + 50;
  if (!isAtBottom && autoScrollEnabled) {
    autoScrollEnabled = false;
    autoScrollBtn.textContent = 'Auto-scroll: OFF';
  }
});
