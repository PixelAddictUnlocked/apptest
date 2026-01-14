const questionnaireEl = document.getElementById('questionnaire');
const answeredEl = document.querySelector('[data-answered]');
const totalEl = document.querySelector('[data-total]');
const progressPercentEl = document.querySelector('[data-progress-percent]');
const progressLabelEl = document.querySelector('[data-progress-label]');
const progressFillEl = document.querySelector('[data-progress-fill]');
const progressTrackEl = document.querySelector('.progress-track');
const actionBarEl = document.querySelector('[data-action-bar]');
const submitBtn = document.querySelector('[data-submit-btn]');
const questionnaireContainer = document.getElementById('questionnaire');

const responses = new Map();
let totalQuestions = 0;
let answeredQuestions = 0;
let isAtEnd = false;
let scrollObserver;

async function loadQuestions() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) throw new Error('Unable to load questionnaire.');
    const data = await res.json();
    renderQuestionnaire(data);
  } catch (error) {
    console.error('Error loading questions:', error);
    questionnaireEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

function renderQuestionnaire(data) {
  questionnaireEl.innerHTML = '';
  totalQuestions = 0;
  answeredQuestions = responses.size;

  const categories = data.categories ?? {};
  Object.values(categories).forEach((category) => {
    const section = document.createElement('section');
    section.className = 'section-block';

    const header = document.createElement('header');
    header.innerHTML = `
      <h2>${category.title}</h2>
      <p>${category.description ?? ''}</p>
    `;
    section.appendChild(header);

    if (Array.isArray(category.questions)) {
      category.questions.forEach((question, index) => {
        const card = createQuestionCard(question, `${slugify(category.title)}-${index}`);
        section.appendChild(card);
      });
    }

    if (category.subcategories) {
      Object.values(category.subcategories).forEach((sub) => {
        const subheading = document.createElement('p');
        subheading.className = 'subsection-title';
        subheading.textContent = sub.title;
        section.appendChild(subheading);

        if (sub.description) {
          const subDesc = document.createElement('p');
          subDesc.className = 'subsection-description';
          subDesc.textContent = sub.description;
          section.appendChild(subDesc);
        }

        sub.questions.forEach((question, index) => {
          const card = createQuestionCard(question, `${slugify(sub.title)}-${index}`);
          section.appendChild(card);
        });
      });
    }

    questionnaireEl.appendChild(section);
  });

  totalEl.textContent = totalQuestions;
  answeredEl.textContent = answeredQuestions;
  updateProgress();
  observeScroll();
}

function createQuestionCard(question, id) {
  const config = getQuestionConfig(question);
  totalQuestions += 1;

  const card = document.createElement('article');
  card.className = 'question-card';

  const title = document.createElement('h3');
  title.textContent = question;
  card.appendChild(title);

  if (config.hint) {
    const hint = document.createElement('p');
    hint.className = 'question-hint';
    hint.textContent = config.hint;
    card.appendChild(hint);
  }

  const control = createControlElement(config, id);
  card.appendChild(control);
  return card;
}

function createControlElement(config, id) {
  if (['likert', 'intensity', 'frequency', 'rating', 'triad'].includes(config.type)) {
    const wrapper = document.createElement('div');
    wrapper.className = config.type === 'frequency' ? 'frequency-options' : 'scale-options';

    config.options.forEach((option) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = id;
      input.value = option.value;
      
      // Use both 'change' and 'click' for better Android compatibility
      const handler = () => handleResponse(id, option.value);
      input.addEventListener('change', handler);
      input.addEventListener('click', handler);

      const visual = document.createElement('span');
      visual.innerHTML = option.abbrev
        ? `<strong>${option.abbrev}</strong>${option.label}`
        : option.label;

      label.appendChild(input);
      label.appendChild(visual);
      wrapper.appendChild(label);
    });

    return wrapper;
  }

  if (config.type === 'slider') {
    const wrapper = document.createElement('div');
    wrapper.className = 'numeric-control';

    const display = document.createElement('div');
    display.className = 'value-display';
    display.innerHTML = `
      <span>${config.labels?.min ?? config.min}</span>
      <strong data-display>${config.format(config.default)}</strong>
      <span>${config.labels?.max ?? config.max}</span>
    `;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = config.default;
    
    input.addEventListener('input', () => {
      display.querySelector('[data-display]').textContent = config.format(input.value);
    });
    input.addEventListener('change', () => handleResponse(id, input.value));
    // Android fallback
    input.addEventListener('touchend', () => handleResponse(id, input.value));

    wrapper.appendChild(display);
    wrapper.appendChild(input);
    return wrapper;
  }

  const fallback = document.createElement('p');
  fallback.textContent = 'Input unavailable for this question.';
  return fallback;
}

function handleResponse(id, value) {
  if (!responses.has(id)) {
    answeredQuestions += 1;
  }
  responses.set(id, value);
  
  if (answeredEl) answeredEl.textContent = answeredQuestions;
  updateProgress();
  toggleFooter();
}

function getQuestionConfig(question) {
  const text = question.toLowerCase();

  if (text.startsWith("i've") || text.startsWith('i have') || text.startsWith('i ')) {
    return {
      type: 'triad',
      hint: '',
      options: createTriadScale(),
    };
  }

  if (text.includes('how often') || text.includes('how consistently')) {
    return {
      type: 'frequency',
      hint: '',
      options: createFrequencyScale(),
    };
  }

  if (text.includes('how would you rate') || text.includes('overall sense of wellbeing')) {
    return {
      type: 'triad',
      hint: '',
      options: createTriadScale(['Low', 'Moderate', 'High']),
    };
  }

  if (text.includes('how long')) {
    const isMinutes = !text.includes('hours');
    return {
      type: 'slider',
      min: 0,
      max: isMinutes ? 120 : 12,
      step: isMinutes ? 5 : 1,
      default: isMinutes ? 30 : 7,
      labels: {
        min: isMinutes ? '0 min' : '0 hrs',
        max: isMinutes ? '120 min' : '12 hrs',
      },
      hint: '',
      format: (value) => `${value}${isMinutes ? ' min' : ' hrs'}`,
    };
  }

  if (text.includes('how many nights have you spent away')) {
    return {
      type: 'slider',
      min: 0,
      max: 20,
      step: 1,
      default: 2,
      labels: { min: '0 nights', max: '20 nights' },
      hint: '',
      format: (value) => `${value} night${Number(value) === 1 ? '' : 's'}`,
    };
  }

  if (text.includes('how many nights per week')) {
    return {
      type: 'slider',
      min: 0,
      max: 7,
      step: 1,
      default: 1,
      labels: { min: '0 nights', max: '7 nights' },
      hint: '',
      format: (value) => `${value} night${Number(value) === 1 ? '' : 's'}`,
    };
  }

  if (
    text.includes('how much time') ||
    text.includes('how much has') ||
    text.includes('how connected') ||
    text.includes('how manageable')
  ) {
    return {
      type: 'triad',
      hint: '',
      options: createTriadScale(['Not at all', 'Moderate', 'Fully']),
    };
  }

  return {
    type: 'triad',
    hint: '',
    options: createTriadScale(),
  };
}

function createTriadScale(labels = ['Low', 'Moderate', 'High']) {
  return [
    { value: '1', label: `<small>${labels[0]}</small>` },
    { value: '2', label: `<small>${labels[1]}</small>` },
    { value: '3', label: `<small>${labels[2]}</small>` },
  ];
}

function createFrequencyScale() {
  return [
    { value: '1', label: '<small>Rarely</small>' },
    { value: '2', label: '<small>Sometimes</small>' },
    { value: '3', label: '<small>Always</small>' },
  ];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function updateProgress() {
  const percent = totalQuestions === 0 ? 0 : Math.round((answeredQuestions / totalQuestions) * 100);
  
  if (progressPercentEl) {
    progressPercentEl.textContent = `${percent}%`;
  }
  if (progressLabelEl) {
    progressLabelEl.textContent = `${answeredQuestions} of ${totalQuestions} complete`;
  }
  if (progressFillEl) {
    progressFillEl.style.width = `${percent}%`;
  }
  if (progressTrackEl) {
    progressTrackEl.setAttribute('aria-valuenow', String(percent));
  }
}

function toggleFooter() {
  if (!actionBarEl || !submitBtn) return;
  const isComplete = answeredQuestions === totalQuestions && totalQuestions > 0;
  if (isComplete || isAtEnd) {
    actionBarEl.classList.remove('action-bar--compact');
    actionBarEl.classList.add('action-bar--expanded');
    submitBtn.setAttribute('aria-hidden', 'false');
    submitBtn.disabled = false;
  } else {
    actionBarEl.classList.add('action-bar--compact');
    actionBarEl.classList.remove('action-bar--expanded');
    submitBtn.setAttribute('aria-hidden', 'true');
    submitBtn.disabled = true;
  }
}

function observeScroll() {
  if (!questionnaireContainer || !actionBarEl) return;
  if (scrollObserver) {
    scrollObserver.disconnect();
  }

  const sentinel = document.querySelector('[data-scroll-sentinel]') ?? document.createElement('div');
  sentinel.setAttribute('data-scroll-sentinel', '');
  sentinel.style.height = '1px';
  sentinel.style.width = '100%';
  
  if (!sentinel.isConnected) {
    questionnaireContainer.appendChild(sentinel);
  }

  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isAtEnd = entry.isIntersecting;
        toggleFooter();
      });
    },
    { threshold: 0.05 }
  );

  scrollObserver.observe(sentinel);
}

// Submit button handler
if (submitBtn) {
  submitBtn.addEventListener('click', () => {
    const result = Object.fromEntries(responses);
    console.log('Questionnaire responses:', result);
    alert('Questionnaire submitted successfully!\n\nResponses: ' + JSON.stringify(result, null, 2));
  });
}

// Initialize
loadQuestions();