import streamlit as st
import numpy as np
import beat_manipulator as bm
import cv2

def BeatSwap(audiofile, pattern='test', scale=1, shift=0, caching=True, variableBPM=False):
    st.write(f'path = {audiofile}, pattern = "{pattern}", scale = {scale}, shift = {shift}, caching = {caching}, variable BPM = {variableBPM}')
    if pattern == '' or pattern is None:
        pattern = 'test'
    if caching is not False:
        caching = True
    if variableBPM is not True:
        variableBPM = False
    try:
        scale = bm.utils._safer_eval(scale)
    except:
        scale = 1
    try:
        shift = bm.utils._safer_eval(shift)
    except:
        shift = 0
    if scale < 0:
        scale = -scale
    if scale < 0.02:
        scale = 0.02
    st.write('Loading audio file...')
    if audiofile is not None:
        try:
            song = bm.song(audio=audiofile, log=False)
        except Exception as e:
            st.write(f'Failed to load audio, retrying: {e}')
            song = bm.song(audio=audiofile, log=False)
    else:
        st.write(f'Audiofile is {audiofile}')
        return None, None
    try:
        st.write(f'Scale = {scale}, shift = {shift}, length = {len(song.audio[0]) / song.sr}')
        if len(song.audio[0]) > (song.sr * 1800):
            song.audio = np.array(song.audio, copy=False)
            song.audio = song.audio[:, :song.sr * 1800]
    except Exception as e:
        st.write(f'Reducing audio size failed, why? {e}')
    lib = 'madmom.BeatDetectionProcessor' if variableBPM is False else 'madmom.BeatTrackingProcessor'
    song.path = '.'.join(song.path.split('.')[:-1])[:-8] + '.' + song.path.split('.')[-1]
    st.write(f'path: {song.path}')
    st.write('Generating beatmap...')
    song.beatmap_generate(lib=lib, caching=caching)
    song.beatmap_shift(shift)
    song.beatmap_scale(scale)
    st.write('Generating image...')
    try:
        song.image_generate()
        image = bm.image.bw_to_colored(song.image)
        y = min(len(image), len(image[0]), 2048)
        y = max(y, 2048)
        image = np.rot90(np.clip(cv2.resize(image, (y, y), interpolation=cv2.INTER_NEAREST), -1, 1))
    except Exception as e:
        st.write(f'Image generation failed: {e}')
        image = np.asarray([[0.5, -0.5], [-0.5, 0.5]])
    st.write('Beatswapping...')
    song.beatswap(pattern=pattern, scale=1, shift=0)
    song.audio = (np.clip(np.asarray(song.audio), -1, 1) * 32766).astype(np.int16).T
    st.write('___ SUCCESS ___')
    return song.sr, song.audio, image

st.title("Stunlocked's Beat Manipulator")

audiofile = st.file_uploader("Upload an audio file", type=["mp3", "wav"])
pattern = st.text_input("Pattern", "1, 2>0.5, 3, 4>0.5, 5, 6>0.5, 3, 4>0.5, 7, 8")
scale = st.number_input("Beatmap scale", value=1.0)
shift = st.number_input("Beatmap shift", value=0.0)
caching = st.checkbox("Enable caching", value=True)
variableBPM = st.checkbox("Enable support for variable BPM", value=False)

if st.button("Run BeatSwap"):
    sr, audio, image = BeatSwap(audiofile, pattern, scale, shift, caching, variableBPM)
    if audio is not None:
        st.audio(audio.tobytes(), format="audio/wav", start_time=0)
    if image is not None:
        st.image(image, caption="Generated Image", use_column_width=True)
