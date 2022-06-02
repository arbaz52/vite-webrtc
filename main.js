import "./style.css";

/**
 *
 * @param {MediaDeviceInfo[]} devices
 */
const populateDevicesSelectors = (devices) => {
  const camerasInputs = document.querySelectorAll(".camerasInput");
  const microphonesInputs = document.querySelectorAll(".microphonesInput");
  const cameras = devices.filter(({ kind }) => kind === "videoinput");
  const microphones = devices.filter(({ kind }) => kind === "audioinput");

  camerasInputs.forEach(
    /**
     *
     * @param {HTMLSelectElement} cameraInput
     */
    (cameraInput) => {
      cameras.forEach((camera) => {
        const option = createOption(camera.deviceId, camera.label);
        cameraInput.appendChild(option);
      });
    }
  );
  microphonesInputs.forEach(
    /**
     *
     * @param {HTMLSelectElement} microphoneInput
     */
    (microphoneInput) => {
      microphones.forEach((microphone) => {
        const option = createOption(microphone.deviceId, microphone.label);
        microphoneInput.appendChild(option);
      });
    }
  );
};

const enumerateMediaDevices = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  stream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();

  populateDevicesSelectors(devices);
};

const createOption = (value, label) => {
  const option = document.createElement("option");
  option.value = value;
  option.innerHTML = label;
  return option;
};

/**
 *
 * @param {"audio" | "video"} type
 * @param {string | undefined} deviceId
 */
const getTrack = async (type, deviceId) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    [type]: deviceId
      ? {
          deviceId,
        }
      : true,
  });
  switch (type) {
    case "audio":
      return stream.getAudioTracks()[0];
    case "video":
      return stream.getVideoTracks()[0];
  }
};

const streams = {
  caller: new MediaStream(),
  callee: new MediaStream(),
};

const remoteStreams = {
  caller: new MediaStream(),
  callee: new MediaStream(),
};

const pcConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
const pcs = {
  caller: new RTCPeerConnection(pcConfiguration),
  callee: new RTCPeerConnection(pcConfiguration),
};

const connectStreamsToPlayers = () => {
  calleePreview.srcObject = streams.callee;
  callerPreview.srcObject = streams.caller;

  remoteCalleePreview.srcObject = remoteStreams.callee;
  remoteCallerPreview.srcObject = remoteStreams.caller;
};

const setupCallerStream = () => {
  const videoDeviceId = callerCameraInput.value;
  const audioDeviceId = callerMicrophoneInput.value;

  return [
    getTrack("video", videoDeviceId).then((track) => {
      pcs.caller.addTrack(track);
      streams.caller.addTrack(track);
    }),
    getTrack("audio", audioDeviceId).then((track) => {
      pcs.caller.addTrack(track);
      streams.caller.addTrack(track);
    }),
  ];
};

const setupCalleeStream = () => {
  const videoDeviceId = calleeCameraInput.value;
  const audioDeviceId = calleeMicrophoneInput.value;

  return [
    getTrack("video", videoDeviceId).then((track) => {
      pcs.callee.addTrack(track);
      streams.callee.addTrack(track);
    }),
    getTrack("audio", audioDeviceId).then((track) => {
      pcs.callee.addTrack(track);
      streams.callee.addTrack(track);
    }),
  ];
};

const createOffer = () => {
  pcs.caller.createOffer().then((offer) => {
    offerInput.value = JSON.stringify(offer);
    pcs.caller.setLocalDescription(offer);
    pcs.callee.setRemoteDescription(offer);
  });
};
const createAnswer = () => {
  pcs.callee.createAnswer().then((answer) => {
    answerInput.value = JSON.stringify(answer);
    pcs.callee.setLocalDescription(answer);
    pcs.caller.setRemoteDescription(answer);
  });
};

const addEventListeners = () => {
  pcs.callee.ontrack = ({ track }) => {
    if (track.kind === "audio")
      remoteStreams.caller.getAudioTracks().forEach((track) => {
        track.stop();
        remoteStreams.caller.removeTrack(track);
      });
    else
      remoteStreams.caller.getVideoTracks().forEach((track) => {
        track.stop();
        remoteStreams.caller.removeTrack(track);
      });
    remoteStreams.caller.addTrack(track);
    console.debug(`callee`, track);
  };

  pcs.caller.ontrack = ({ track }) => {
    if (track.kind === "audio")
      remoteStreams.callee.getAudioTracks().forEach((track) => {
        track.stop();
        remoteStreams.callee.removeTrack(track);
      });
    else
      remoteStreams.callee.getVideoTracks().forEach((track) => {
        track.stop();
        remoteStreams.callee.removeTrack(track);
      });
    remoteStreams.callee.addTrack(track);
    console.debug(`caller`, track);
  };

  pcs.caller.onicecandidate = ({ candidate }) => {
    pcs.callee.addIceCandidate(candidate);
  };

  pcs.callee.onicecandidate = ({ candidate }) => {
    pcs.caller.addIceCandidate(candidate);
  };

  callerCameraInput.onchange = ({ target: { value: deviceId } }) => {
    getTrack("video", deviceId).then((track) => {
      streams.caller.getVideoTracks().forEach((track) => {
        track.stop();
        streams.caller.removeTrack(track);
      });
      const sender = pcs.caller
        .getSenders()
        .find((sender) => sender.track?.kind === track.kind);

      sender.replaceTrack(track);
      streams.caller.addTrack(track);
    });
  };
  callerMicrophoneInput.onchange = ({ target: { value: deviceId } }) => {
    getTrack("audio", deviceId).then((track) => {
      streams.caller.getAudioTracks().forEach((track) => {
        track.stop();
        streams.caller.removeTrack(track);
      });
      streams.caller.addTrack(track);

      const sender = pcs.caller
        .getSenders()
        .find((sender) => sender.track?.kind === track.kind);

      sender.replaceTrack(track);
    });
  };

  calleeCameraInput.onchange = ({ target: { value: deviceId } }) => {
    getTrack("video", deviceId).then((track) => {
      streams.callee.getVideoTracks().forEach((track) => {
        track.stop();
        streams.callee.removeTrack(track);
      });
      streams.callee.addTrack(track);

      const sender = pcs.callee
        .getSenders()
        .find((sender) => sender.track?.kind === track.kind);

      sender.replaceTrack(track);
    });
  };
  calleeMicrophoneInput.onchange = ({ target: { value: deviceId } }) => {
    getTrack("audio", deviceId).then((track) => {
      streams.callee.getAudioTracks().forEach((track) => {
        track.stop();
        streams.callee.removeTrack(track);
      });
      streams.callee.addTrack(track);

      const sender = pcs.callee
        .getSenders()
        .find((sender) => sender.track?.kind === track.kind);

      sender.replaceTrack(track);
    });
  };

  createOfferButton.onclick = createOffer;
  createAnswerButton.onclick = createAnswer;
};

enumerateMediaDevices().then(() => {
  addEventListeners();
  Promise.all([...setupCallerStream(), ...setupCalleeStream()]).then(
    connectStreamsToPlayers
  );
});
