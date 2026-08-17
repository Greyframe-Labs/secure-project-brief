const ENCRYPTED_VIDEO_URL = "assets/recruiter-brief.enc";
const ENCRYPTED_VIDEO_PARTS = [
  "assets/recruiter-brief.enc.part1",
  "assets/recruiter-brief.enc.part2"
];
const PBKDF2_ITERATIONS = 600000;
const MAGIC = new Uint8Array([0x53, 0x50, 0x42, 0x31]); // SPB1
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

const accessGate = document.getElementById("accessGate");
const briefing = document.getElementById("briefing");
const accessForm = document.getElementById("accessForm");
const accessPhrase = document.getElementById("accessPhrase");
const unlockButton = document.getElementById("unlockButton");
const unlockButtonLabel = unlockButton.querySelector("span:first-child");
const accessMessage = document.getElementById("accessMessage");
const briefVideo = document.getElementById("briefVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const videoPlaceholderCopy = videoPlaceholder.querySelector("p");
const headerState = document.getElementById("headerState");
const footerState = document.getElementById("footerState");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let decryptedVideoUrl = null;
let revealObserver = null;

function setMessage(message, state = "neutral") {
  accessMessage.textContent = message;
  accessMessage.classList.remove("error", "success");
  if (state === "error") accessMessage.classList.add("error");
  if (state === "success") accessMessage.classList.add("success");
}

function setBusy(isBusy) {
  unlockButton.disabled = isBusy;
  accessPhrase.disabled = isBusy;
  unlockButton.setAttribute("aria-busy", String(isBusy));
  unlockButtonLabel.textContent = isBusy ? "DECRYPTING" : "OPEN BRIEF";
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a[i] ^ b[i];
  }
  return difference === 0;
}

async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["decrypt"]
  );
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "NOT_FOUND" : "MEDIA_FETCH_FAILED");
    error.status = response.status;
    throw error;
  }
  return response.arrayBuffer();
}

async function fetchEncryptedBrief() {
  try {
    return await fetchArrayBuffer(ENCRYPTED_VIDEO_URL);
  } catch (error) {
    if (error?.message !== "NOT_FOUND") throw error;
  }

  const partBuffers = [];
  for (const partUrl of ENCRYPTED_VIDEO_PARTS) {
    try {
      partBuffers.push(await fetchArrayBuffer(partUrl));
    } catch (error) {
      if (error?.message === "NOT_FOUND") {
        throw new Error("MEDIA_NOT_DEPLOYED");
      }
      throw error;
    }
  }

  const totalLength = partBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of partBuffers) {
    const bytes = new Uint8Array(buffer);
    combined.set(bytes, offset);
    offset += bytes.length;
  }

  return combined.buffer;
}

function parseEncryptedBrief(buffer) {
  const bytes = new Uint8Array(buffer);
  const minimumLength = MAGIC.length + SALT_LENGTH + IV_LENGTH + 16;

  if (bytes.length < minimumLength) {
    throw new Error("INVALID_MEDIA");
  }

  const magic = bytes.slice(0, MAGIC.length);
  if (!bytesEqual(magic, MAGIC)) {
    throw new Error("INVALID_MEDIA");
  }

  let cursor = MAGIC.length;
  const salt = bytes.slice(cursor, cursor + SALT_LENGTH);
  cursor += SALT_LENGTH;
  const iv = bytes.slice(cursor, cursor + IV_LENGTH);
  cursor += IV_LENGTH;
  const ciphertext = bytes.slice(cursor);

  return { salt, iv, ciphertext };
}

async function decryptBrief(buffer, passphrase) {
  const { salt, iv, ciphertext } = parseEncryptedBrief(buffer);
  const key = await deriveKey(passphrase, salt);

  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    ciphertext
  );
}

function prepareRevealTargets() {
  const directTargets = briefing.querySelectorAll(
    ".briefing-intro, .video-section, .proof-band .shell, .systems-heading, .system-card, .fit-statement, .closing"
  );

  directTargets.forEach((element) => element.classList.add("reveal"));

  const staggerTargets = briefing.querySelectorAll(".reveal-stagger");
  staggerTargets.forEach((element) => element.classList.add("reveal-stagger"));
}

function activateRevealMotion() {
  const targets = briefing.querySelectorAll(".reveal, .reveal-stagger");

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  if (revealObserver) revealObserver.disconnect();

  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -7% 0px"
    }
  );

  targets.forEach((element) => revealObserver.observe(element));
}

function revealBriefing(decryptedBuffer) {
  if (decryptedVideoUrl) {
    URL.revokeObjectURL(decryptedVideoUrl);
  }

  const videoBlob = new Blob([decryptedBuffer], { type: "video/mp4" });
  decryptedVideoUrl = URL.createObjectURL(videoBlob);
  briefVideo.src = decryptedVideoUrl;
  briefVideo.load();

  accessGate.hidden = true;
  briefing.hidden = false;
  document.body.dataset.state = "unlocked";
  headerState.textContent = "BUILD BRIEF / ACCESS GRANTED";
  footerState.textContent = "BRIEF DECRYPTED LOCALLY";
  videoPlaceholderCopy.textContent = "Loading decrypted briefing media";

  prepareRevealTargets();
  activateRevealMotion();

  requestAnimationFrame(() => {
    briefing.scrollIntoView({
      behavior: reduceMotion.matches ? "auto" : "smooth",
      block: "start"
    });
  });
}

briefVideo.addEventListener("canplay", () => {
  videoPlaceholder.classList.add("hidden");
});

briefVideo.addEventListener("error", () => {
  videoPlaceholder.classList.remove("hidden");
  videoPlaceholderCopy.textContent = "Decrypted media could not be prepared for playback";
});

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const passphrase = accessPhrase.value;
  if (!passphrase) {
    setMessage("Enter the access phrase supplied with the briefing link.", "error");
    accessPhrase.focus();
    return;
  }

  setBusy(true);
  setMessage("Retrieving encrypted media and deriving a local decryption key…");

  try {
    const encryptedBuffer = await fetchEncryptedBrief();
    const decryptedBuffer = await decryptBrief(encryptedBuffer, passphrase);

    setMessage("Access granted. Briefing decrypted locally.", "success");
    accessPhrase.value = "";
    revealBriefing(decryptedBuffer);
  } catch (error) {
    if (error?.message === "MEDIA_NOT_DEPLOYED") {
      setMessage("The encrypted recruiter video has not been deployed yet.", "error");
    } else if (error?.message === "MEDIA_FETCH_FAILED") {
      setMessage("The encrypted media could not be retrieved. Try again later.", "error");
    } else if (error?.message === "INVALID_MEDIA") {
      setMessage("The encrypted media package is invalid or incomplete.", "error");
    } else {
      setMessage("Access phrase not accepted. Verify the phrase and try again.", "error");
    }
  } finally {
    setBusy(false);
    accessPhrase.value = "";

    if (document.body.dataset.state !== "unlocked") {
      accessPhrase.focus();
    }
  }
});

reduceMotion.addEventListener?.("change", () => {
  if (document.body.dataset.state === "unlocked") {
    activateRevealMotion();
  }
});

window.addEventListener("beforeunload", () => {
  if (revealObserver) revealObserver.disconnect();
  if (decryptedVideoUrl) {
    URL.revokeObjectURL(decryptedVideoUrl);
  }
});
