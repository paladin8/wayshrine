"""Synthesises the footstep loops (meadow, snow, mountain, marsh) into public/audio/cues/walk-<surface>-synth.wav.
Usage: python3 scripts/synth-footsteps.py public/audio/cues. Six steps per loop, 2.9 steps/s to match the walk cycle;
levels are matched to the supplied recordings. Needs numpy and scipy."""
import numpy as np, wave
from scipy import signal
SR=48000
STEP=1/2.9           # seconds between footfalls, locked to the walk cycle (1.45 Hz, two feet)
N=6                  # steps per loop
LOOP=int(round(STEP*N*SR))
rng=np.random.default_rng(7)

def noise(n): return rng.standard_normal(n)
def bp(x,lo,hi,order=2): return signal.sosfilt(signal.butter(order,[lo,hi],'band',fs=SR,output='sos'),x)
def lp(x,f,order=2): return signal.sosfilt(signal.butter(order,f,'low',fs=SR,output='sos'),x)
def hp(x,f,order=2): return signal.sosfilt(signal.butter(order,f,'high',fs=SR,output='sos'),x)
def env(n,a,d,shape=3.0):
    t=np.arange(n)/SR
    e=np.minimum(1,t/max(a,1e-4))*np.exp(-t/d*shape/3*3)
    return e
def thump(n,f0,f1,d,amp):
    t=np.arange(n)/SR
    f=f1+(f0-f1)*np.exp(-t/0.02)
    ph=2*np.pi*np.cumsum(f)/SR
    return amp*np.sin(ph)*np.exp(-t/d)
def grains(n,count,lo,hi,d,spread):
    """Scattered tiny clicks, each a short band-passed burst (crunch, gravel)."""
    out=np.zeros(n)
    for _ in range(count):
        pos=int(abs(rng.normal(0,spread))*SR)
        if pos>=n-200: continue
        L=int(rng.uniform(0.002,0.008)*SR)
        g=noise(L)*np.exp(-np.arange(L)/(L/4))
        f=rng.uniform(lo,hi)
        g=bp(g,f*0.7,min(f*1.4,SR/2-100))
        out[pos:pos+L]+=g*rng.uniform(0.3,1.0)
    return out

def meadow(k,side):
    n=int(0.30*SR)
    heel=thump(n,rng.uniform(80,100),50,0.05,0.9)
    swish=bp(noise(n),500,2600)*env(n,0.012,0.07)*0.55
    leaf=hp(bp(noise(n),3000,7000),3000)*env(n,0.03,0.05)*0.12
    toe=np.roll(bp(noise(n),900,3500)*env(n,0.01,0.05),int(0.07*SR))*0.3
    return lp(heel,260)+swish+leaf+toe
def snow(k,side):
    n=int(0.32*SR)
    body=lp(noise(n),900)*env(n,0.01,0.09)*0.35
    cr=grains(n,rng.integers(28,40),1800,7000,0.1,0.06)*0.9
    squeak=bp(noise(n),2500,4500)*env(n,0.02,0.04)*0.08
    low=thump(n,70,45,0.06,0.45)
    return body+cr+squeak+lp(low,200)
def mountain(k,side):
    n=int(0.30*SR)
    tap=bp(noise(int(0.03*SR)),700,1100)*env(int(0.03*SR),0.0005,0.01); tap=np.pad(tap,(0,n-len(tap)))
    ring=thump(n,rng.uniform(420,520),380,0.025,0.25)
    grit=grains(n,rng.integers(14,22),1200,5200,0.1,0.05)
    slide=hp(noise(n),1500)*env(n,0.04,0.06)*0.10
    thud=lp(thump(n,95,55,0.04,0.8),300)
    return tap*1.4+ring+grit*0.9+slide+thud
def marsh(k,side):
    n=int(0.36*SR)
    t=np.arange(n)/SR
    # squelch: noise through a band whose centre falls as the foot sinks
    x=noise(n); out=np.zeros(n); blk=256
    for i in range(0,n-blk,blk):
        fc=max(120,650*np.exp(-t[i]/0.09))
        seg=bp(x[i:i+blk+0],fc*0.6,fc*1.5)
        out[i:i+blk]+=seg
    squelch=out*env(n,0.01,0.11)*1.6
    slap=lp(thump(n,110,60,0.05,0.9),300)
    pops=np.zeros(n)
    for _ in range(rng.integers(1,3)):
        pos=int(rng.uniform(0.06,0.24)*SR); L=int(0.035*SR)
        tt=np.arange(L)/SR
        f=rng.uniform(250,420)*(1+tt/0.035*1.6)
        pops[pos:pos+L]+=0.35*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt/0.012)
    suck=lp(hp(noise(n),300),1800)*np.roll(env(n,0.05,0.06),int(0.14*SR))*0.15
    return squelch+slap+pops+suck

def render(fn,seed,jitter=0.012):
    global rng
    rng=np.random.default_rng(seed)
    out=np.zeros((LOOP+SR//2,2))
    for k in range(N):
        side=k%2
        s=fn(k,side)*rng.uniform(0.85,1.1)*(1.0 if side==0 else 0.93)
        off=int((k*STEP+rng.uniform(-jitter,jitter)*(k>0))*SR)
        pan=0.42+0.16*side  # L foot a touch left, R a touch right
        L=s*np.cos(pan*np.pi/2)*1.2; R=s*np.sin(pan*np.pi/2)*1.2
        e=min(len(s),out.shape[0]-off)
        out[off:off+e,0]+=L[:e]; out[off:off+e,1]+=R[:e]
    # wrap the tail back onto the start for a seamless loop
    out[:SR//2]+=0
    body=out[:LOOP].copy(); body[:SR//2 if False else out.shape[0]-LOOP]+=out[LOOP:]
    return body

def write(path,a,target_rms):
    m=a.mean(1); r=np.sqrt((m**2).mean()); a=a*(target_rms/r)
    pk=abs(a).max()
    if pk>0.95: a=a*(0.95/pk)
    pcm=(np.clip(a,-1,1)*32767).astype('<i2')
    w=wave.open(path,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
    return float(np.sqrt((a.mean(1)**2).mean())), float(abs(a).max())

if __name__=='__main__':
    import sys
    out=sys.argv[1]
    for name,fn,seed,rms in [('meadow',meadow,3,0.0222),('snow',snow,5,0.018),('mountain',mountain,9,0.0352),('marsh',marsh,11,0.0222)]:
        print(name,write(f'{out}/walk-{name}-synth.wav',render(fn,seed),rms))
