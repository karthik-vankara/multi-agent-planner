let memoryStore = {
  pastAttempts: [],
  learnings: []
};

export function addAttempt(data) {
  memoryStore.pastAttempts.push(data);
}

export function getAttempts() {
  return memoryStore.pastAttempts;
}

export function addLearning(learning) {
  if (!memoryStore.learnings.includes(learning)) {
    memoryStore.learnings.push(learning);
  }
}

export function getLearnings() {
  return memoryStore.learnings;
}

export function clearMemory() {
  memoryStore = {
    pastAttempts: [],
    learnings: []
  };
}