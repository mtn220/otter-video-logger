import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import { emitTo } from '@tauri-apps/api/event'

let videoFolderPath = null;
let videoData = [];
let platform = null;

const folderTextDiv = document.querySelector('#folder-text-field');
const outputDiv = document.querySelector('#output');
const alertsContainer = document.querySelector('#alerts-container');
const videoSelector = document.querySelector('#video-selector');
let lastTriggeredVideoValue = null;
function handleVideoSelectorEvent() {
    const value = videoSelector.value;
    if (value && value !== lastTriggeredVideoValue) {
        lastTriggeredVideoValue = value;
        changeVideo();
    }
}
videoSelector.addEventListener('change', handleVideoSelectorEvent);
videoSelector.addEventListener('mousedown', handleVideoSelectorEvent);
const pasteInstructions = document.querySelector('#paste-instructions');

invoke('get_platform').then((response) => {
    platform = response;
    pasteInstructions.innerHTML = `<i>Paste With ${
        platform == 'darwin' ? 'Cmd' : 'Ctrl'
    } + Shift + V</i>`;
});

const checkFieldLinks = {
    vocalizations: [
        'behavior-vocalizations-append',
        'description-vocalizations-append',
    ],
    prey: ['behavior-prey-append', 'description-prey-append'],
};

const inputsNodeList = document.querySelectorAll('input');
const inputsObj = {};
inputsNodeList.forEach((node) => {
    if (node.id) {
        inputsObj[node.id] = node;
        if (
            node.id != 'file-name' &&
            node.id != 'description' &&
            node.type == 'text'
        ) {
            node.addEventListener('input', updateData);
        }
    }
});
inputsObj['file-name'].addEventListener('input', handleFileNameInput);
inputsObj['description'].addEventListener('input', handleDescriptionInput);
inputsObj['brightness-slider'].addEventListener('input', (event) => {
    emitTo('video', 'set-video-css', {
        name: 'filter',
        value: `brightness(${event.target.value}%)`,
    });
});

const buttonsNodeList = document.querySelectorAll('button');
const buttonsObj = {};
buttonsNodeList.forEach((node) => {
    if (node.id) {
        buttonsObj[node.id] = node;
    }
});

buttonsObj['select-folder-button'].onclick = async () => {
    const result = await invoke('open_video_folder');
    if (!result) return;

    videoFolderPath = result.folderPath;
    folderTextDiv.innerText = result.folderPath;
    videoData = [];

    const newOptions = [];
    if (result.videos.length > 0) {
        result.videos.forEach((video, i) => {
            const dateTime = parseDateAndTime(new Date(video.modifiedMs));
            if (
                i > 0 &&
                dateTime &&
                videoData[i - 1].time.slice(0, -2) ==
                    dateTime.time.slice(0, -2)
            ) {
                const prevSeconds = Number.parseInt(
                    videoData[i - 1].time.slice(-2),
                );
                if (Number.isInteger(prevSeconds)) {
                    const newSeconds = prevSeconds + 1;
                    dateTime.time =
                        dateTime.time.slice(0, -2) +
                        String(newSeconds).padStart(2, '0');
                }
            }
            videoData[i] = {
                fileName: video.name,
                date: dateTime?.date,
                time: dateTime?.time,
            };

            let opt = document.createElement('option');
            opt.value = video.name;
            opt.innerText = video.name;
            newOptions.push(opt);
        });
    } else {
        let opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'No video files in selected folder';
        newOptions.push(opt);
    }

    lastTriggeredVideoValue = null;
    videoSelector.replaceChildren(...newOptions);
};

buttonsObj['copy-data-button'].onclick = dataToClipboard;
buttonsObj['next-video-button'].onclick = handleNextVideo;
buttonsObj['prev-video-button'].onclick = handlePrevVideo;
buttonsObj['replay-video-button'].onclick = handleReplayVideo;
buttonsObj['append-button'].onclick = handleAppend;
buttonsObj['delete-button'].onclick = handleDelete;
buttonsObj['first-last-button'].onclick = markFirstLast;
buttonsObj['append-otter-button'].onclick = () => {
    inputsObj['description'].value = 'Otter';
    handleDescriptionInput();
};
buttonsObj['reset-file-name-button'].onclick = () => {
    const index = videoSelector.selectedIndex;
    inputsObj['file-name'].value = videoData[index].fileName;
    handleFileNameInput();
};
buttonsObj['change-file-name-button'].onclick = () => {
    const index = videoSelector.selectedIndex;
    const oldName = videoData[index].fileName;
    const newText = inputsObj['file-name'].value;
    handleRename({ oldName, newText, type: 'replace' });
};
buttonsObj['reset-brightness-button'].onclick = () => {
    inputsObj['brightness-slider'].value = 100;
    emitTo('video', 'set-video-css', {
        name: 'filter',
        value: 'brightness(100%)',
    });
};

function handleDescriptionInput() {
    if (inputsObj['description'].value) {
        buttonsObj['append-button'].disabled = false;
    } else {
        buttonsObj['append-button'].disabled = true;
    }
}

Object.keys(checkFieldLinks).forEach((checkId) => {
    inputsObj[checkId].addEventListener('change', (event) => {
        const index = videoSelector.selectedIndex;
        if (index >= 0 && videoData.length > 0) {
            videoData[index][checkId] = event.target.checked;

            const newDisplay = event.target.checked ? 'block' : 'none';
            checkFieldLinks[checkId].forEach(
                (textId) =>
                    (document.getElementById(textId).style.display =
                        newDisplay),
            );

            updateOutput();
        }
    });
});

function appendAlert(message, type) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`,
        `   <div>${message}</div>`,
        '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
        '</div>',
    ].join('');
    alertsContainer.append(wrapper);
}

function errorAlert(message) {
    appendAlert(message, 'danger');
}

function updateData() {
    const index = videoSelector.selectedIndex;
    if (index >= 0 && videoData.length > 0) {
        videoData[index].date = inputsObj['date'].value;
        videoData[index].time = inputsObj['time'].value;
        videoData[index].initials = inputsObj['initials'].value;
        videoData[index].siteCode = inputsObj['site-code'].value;
        videoData[index].numOtters = inputsObj['num-otters'].value;
        videoData[index].numAdults = inputsObj['num-adults'].value;
        videoData[index].numPups = inputsObj['num-pups'].value;
        videoData[index].behavior = inputsObj['behavior'].value;
        videoData[index].note = inputsObj['note'].value;
        videoData[index].prey = inputsObj['prey'].checked;
        videoData[index].vocalizations = inputsObj['vocalizations'].checked;

        updateOutput();
    }
}

function getBehaviorString() {
    let behavior = inputsObj['behavior'].value;
    if (inputsObj['vocalizations'].checked) {
        behavior = addTrailingComma(behavior) + ' Vocalizations';
    }
    if (inputsObj['prey'].checked) {
        behavior = addTrailingComma(behavior) + ' Prey';
    }
    return behavior;
}

function updateOutput() {
    const index = videoSelector.selectedIndex;
    if (index >= 0 && videoData.length > 0) {
        let output = '<table><tr>';
        output += `<td>${inputsObj['date'].value}</td><td>${inputsObj['time'].value}</td>`;
        output += `<td>${inputsObj['initials'].value}</td><td>${inputsObj['site-code'].value}</td>`;
        output += `<td>${inputsObj['num-otters'].value}</td><td>${inputsObj['num-adults'].value}</td><td></td>`;
        output += `<td>${
            inputsObj['num-pups'].value
        }</td><td>${getBehaviorString()}</td>`;
        output += `<td>${inputsObj['note'].value}</td></tr></table>`;
        outputDiv.innerHTML = output;
    }
}

function addTrailingComma(str) {
    if (str.slice(-1) != ',') {
        return str + ',';
    }
}

function handleFileNameInput() {
    const index = videoSelector.selectedIndex;
    if (index >= 0 && videoData.length > 0) {
        const actualFileName = videoData[index].fileName;
        const inputFileName = inputsObj['file-name'].value;
        if (inputFileName != actualFileName) {
            buttonsObj['change-file-name-button'].disabled = false;
            buttonsObj['reset-file-name-button'].disabled = false;
        } else {
            buttonsObj['change-file-name-button'].disabled = true;
            buttonsObj['reset-file-name-button'].disabled = true;
        }
    }
}

function handleNextVideo() {
    if (videoSelector.selectedIndex < videoData.length - 2) {
        videoSelector.selectedIndex++;
    }
    changeVideo();
}

function handlePrevVideo() {
    if (videoSelector.selectedIndex > 0) {
        videoSelector.selectedIndex--;
    }
    changeVideo();
}

function handleReplayVideo() {
    emitTo('video', 'replay-video', {});
}

async function handleAppend() {
    let newText = inputsObj['description'].value;
    if (inputsObj['vocalizations'].checked) {
        newText += '_Vocalizations';
    }
    if (inputsObj['prey'].checked) {
        newText += '_Prey';
    }
    const oldName = videoSelector.value;
    await handleRename({ oldName, newText, type: 'append', changeToNextVideo: true });
}

async function handleDelete() {
    const newText = 'DELETE';
    const oldName = videoSelector.value;
    await handleRename({ oldName, newText, type: 'prepend', changeToNextVideo: true });
}

async function handleRename({
    oldName,
    newText,
    type,
    futureArgs,
    changeToNextVideo,
}) {
    if (!videoFolderPath) {
        errorAlert(
            'Error renaming file. No video folder specified. Please select a folder with video files in it.',
        );
        return;
    } else if (!oldName) {
        errorAlert(
            'Error renaming file. No old/original file name specified. Make sure you have selected a video file.',
        );
        return;
    } else if (!newText) {
        errorAlert(
            "Error renaming file. No new text specified for renaming. Make sure you type something in the \"What's in the video\" field.",
        );
        return;
    } else if (!type) {
        errorAlert(
            'Error renaming file. No renaming type specified. Valid types: append, prepend, replace.',
        );
        return;
    }

    try {
        const result = await invoke('rename_file', {
            oldName,
            newText,
            renameType: type,
            folderPath: videoFolderPath,
        });

        const index = videoData.findIndex(
            (video) => video.fileName == result.oldName,
        );
        if (index >= 0 && videoData.length > 0) {
            videoData[index].fileName = result.newName;
            const options = Array.from(videoSelector.options);
            options[index].value = result.newName;
            options[index].innerText = result.newName;

            if (futureArgs && futureArgs.length > 0) {
                const nextArgs = futureArgs.shift();
                await handleRename({ ...nextArgs, futureArgs });
            } else if (changeToNextVideo) {
                handleNextVideo();
            } else {
                changeVideo();
            }
        } else {
            errorAlert(
                'Error updating select option after renaming file. Could not find option with old video name',
            );
            errorAlert(`oldName: ${result.oldName}\nnewName: ${result.newName}`);
        }
    } catch (err) {
        errorAlert(String(err));
    }
}

function markFirstLast() {
    if (videoData.length > 0) {
        const firstOldName = videoData[0].fileName;
        const lastOldName = videoData[videoData.length - 1].fileName;

        handleRename({
            oldName: firstOldName,
            newText: 'FirstVideo',
            type: 'append',
            futureArgs: [
                {
                    oldName: lastOldName,
                    newText: 'LastVideo',
                    type: 'append',
                },
            ],
        });
    } else {
        errorAlert('Error marking first & last. Select video folder first.');
    }
}

async function dataToClipboard() {
    let toCopy = `${inputsObj['date'].value}\t${inputsObj['time'].value}\t`;
    toCopy += `${inputsObj['initials'].value}\t${inputsObj['site-code'].value}\t`;
    toCopy += `${inputsObj['num-otters'].value}\t${inputsObj['num-adults'].value}\t\t`;
    toCopy += `${inputsObj['num-pups'].value}\t${getBehaviorString()}\t`;
    toCopy += `${inputsObj['note'].value}`;

    try {
        await invoke('data_to_clipboard', { text: toCopy });
    } catch (err) {
        errorAlert(String(err));
    }
}

function updateFormForVideo(index) {
    inputsObj['date'].value = videoData[index].date;
    inputsObj['time'].value = videoData[index].time;
    inputsObj['initials'].value =
        videoData[index].initials || inputsObj['initials'].value || '';
    inputsObj['site-code'].value =
        videoData[index].siteCode || inputsObj['site-code'].value || '';
    inputsObj['num-otters'].value = videoData[index].numOtters || '';
    inputsObj['num-adults'].value = videoData[index].numAdults || '';
    inputsObj['num-pups'].value = videoData[index].numPups || '';
    inputsObj['behavior'].value = videoData[index].behavior || '';
    inputsObj['note'].value = videoData[index].note || '';
    inputsObj['description'].value = videoData[index].description || '';
    inputsObj['file-name'].value = videoData[index].fileName;
    inputsObj['vocalizations'].checked =
        videoData[index].vocalizations || false;
    inputsObj['prey'].checked = videoData[index].prey || false;

    handleFileNameInput();
    updateOutput();
}

async function changeVideo() {
    const newVideoName = videoSelector.value;
    const index = videoSelector.selectedIndex;
    if (newVideoName) {
        await invoke('change_video', {
            folderPath: videoFolderPath,
            fileName: newVideoName,
        });
        updateFormForVideo(index);
    }
}

function parseDateAndTime(videoDateObj) {
    if (videoDateObj) {
        const year = videoDateObj.getFullYear();
        const month = (videoDateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = videoDateObj.getDate().toString().padStart(2, '0');
        const parsedDate = `${year}-${month}-${day}`;

        const hours = videoDateObj.getHours().toString().padStart(2, '0');
        const minutes = videoDateObj.getMinutes().toString().padStart(2, '0');
        const parsedTime = `${hours}-${minutes}-00`;

        return { date: parsedDate, time: parsedTime };
    } else {
        errorAlert(
            `Error: parseDateAndTime called without DateTime object. Received: ${videoDateObj}`,
        );
        return null;
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') window.__TAURI__.core.invoke('open_devtools');
});
