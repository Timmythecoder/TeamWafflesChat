document.addEventListener('DOMContentLoaded', () => {
    // --- SHUTDOWN LISTENER ---
    let maintenanceCountdownInterval = null;

    if (typeof firebase !== 'undefined' && firebase.database && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('config/maintenance').on('value', snap => {
            const data = snap.val() || {};
            const overlayId = 'site-shutdown-overlay';
            let overlay = document.getElementById(overlayId);

            if (data.enabled === true) {
                if (sessionStorage.getItem('maintenance_bypassed') === 'true') {
                    if (overlay) overlay.remove();
                    return;
                }

                if (!document.getElementById('site-shutdown-overlay')) {
                    overlay = document.createElement('div');
                    overlay.id = 'site-shutdown-overlay';
                    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#121212; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#eee; font-family:'Segoe UI', sans-serif; text-align:center; padding:20px;";
                    document.body.appendChild(overlay);
                }
                const imgHTML = data.imageURL ? `<img src="${data.imageURL}" style="max-width:800px; max-height:600px; width:90%; margin-bottom:20px; border-radius:10px; box-shadow:0 0 20px rgba(0,0,0,0.5);">` : '';
                const msgHTML = data.message || "<h1 style='color:#f04747;font-size:2rem;margin-bottom:10px;'>⚠️ SYSTEM MAINTENANCE ⚠️</h1><p style='font-size:1.2rem;color:#ccc;'>The site is currently offline for maintenance.</p>";
                const countdownHTML = `<div id="maint-countdown" style="font-size: 1.5rem; color: #ffc107; margin-top: 15px; font-weight: bold;"></div>`;
                const bypassHTML = `
                <div id="maint-bypass-container" style="margin-top:20px;">
                    <button id="maint-bypass-toggle-btn" style="padding:8px 16px; background:rgba(255,255,255,0.1); color:#888; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:0.8rem;">Admin Bypass</button>
                    <div id="maint-pin-area" style="display:none; margin-top:10px; display:flex; gap: 5px; justify-content:center; align-items:center;">
                        <input type="password" id="maint-pin-input" placeholder="PIN" style="background:rgba(0,0,0,0.5); color:white; border:1px solid #555; border-radius:4px; padding: 8px; text-align:center; width: 100px;">
                        <button id="maint-pin-submit-btn" style="padding:8px 16px; background:#5865F2; color:white; border:none; border-radius:4px; cursor:pointer;">Enter</button>
                    </div>
                </div>`;
                overlay.innerHTML = `${imgHTML}<div class="shutdown-msg">${msgHTML}</div>${countdownHTML}${bypassHTML}`;
                
                // Countdown Logic
                if (data.endsAt && data.endsAt > Date.now()) {
                    const countdownEl = document.getElementById('maint-countdown');
                    if (countdownEl) {
                        clearInterval(maintenanceCountdownInterval);
                        maintenanceCountdownInterval = setInterval(() => {
                            const remaining = data.endsAt - Date.now();
                            if (remaining <= 0) {
                                clearInterval(maintenanceCountdownInterval);
                                countdownEl.innerHTML = "Maintenance period has ended.";
                                return;
                            }
                            const d = Math.floor(remaining / 86400000);
                            const h = Math.floor((remaining % 86400000) / 3600000);
                            const m = Math.floor((remaining % 3600000) / 60000);
                            const s = Math.floor((remaining % 60000) / 1000);
                            countdownEl.innerHTML = `Time Remaining: ${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
                        }, 1000);
                    }
                }

                // Bypass Logic
                const toggleBtn = document.getElementById('maint-bypass-toggle-btn');
                const pinArea = document.getElementById('maint-pin-area');
                const submitBtn = document.getElementById('maint-pin-submit-btn');
                const pinInput = document.getElementById('maint-pin-input');
                if (toggleBtn) toggleBtn.onclick = () => { pinArea.style.display = pinArea.style.display === 'none' ? 'flex' : 'none'; if (pinArea.style.display === 'flex') pinInput.focus(); };
                if (submitBtn) {
                    const handlePinSubmit = () => {
                        const pin = pinInput.value;
                        if(!pin) return;
                        firebase.database().ref('config/adminPin').once('value').then(pSnap => {
                            const realPin = pSnap.exists() ? String(pSnap.val()) : "1234";
                            if(pin === realPin) {
                                sessionStorage.setItem('maintenance_bypassed', 'true');
                                overlay.remove();
                                clearInterval(maintenanceCountdownInterval);
                            } else {
                                alert("Incorrect PIN");
                                pinInput.value = '';
                            }
                        });
                    };
                    submitBtn.onclick = handlePinSubmit;
                    pinInput.onkeydown = e => { if (e.key === 'Enter') handlePinSubmit(); };
                }
            } else {
                overlay = document.getElementById(overlayId);
                if (overlay) overlay.remove();
                clearInterval(maintenanceCountdownInterval);
            }
        });
    }

    // --- BROADCAST LISTENER ---
    if (typeof firebase !== 'undefined' && firebase.database && firebase.apps && firebase.apps.length > 0) {
        firebase.database().ref('config/broadcast').limitToLast(1).on('child_added', snap => {
            const broadcast = snap.val();
            if (!broadcast || !broadcast.timestamp) return;

            const lastSeen = localStorage.getItem('lastBroadcastTimestamp') || 0;
            if (broadcast.timestamp > lastSeen) {
                localStorage.setItem('lastBroadcastTimestamp', broadcast.timestamp);
                showBroadcastPopup(broadcast.message);
            }
        });
    }

    function showBroadcastPopup(message) {
        if (!document.getElementById('broadcast-popup-styles')) {
            const style = document.createElement('style');
            style.id = 'broadcast-popup-styles';
            style.textContent = `
                .broadcast-popup-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:2147483647; display:flex; align-items:center; justify-content:center; animation: broadcastFadeIn 0.3s ease; }
                .broadcast-popup-content { background:#2f3136; color:#dcddde; padding:25px; border-radius:10px; max-width:450px; width:90%; text-align:center; box-shadow:0 5px 25px rgba(0,0,0,0.5); border:1px solid #40444b; }
                .broadcast-popup-content h3 { color:#5865F2; margin-top:0; }
                .broadcast-popup-content p { line-height:1.6; }
                .broadcast-popup-content button { background:#5865F2; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; margin-top:15px; transition: opacity 0.2s; }
                .broadcast-popup-content button:disabled { opacity: 0.5; cursor: not-allowed; }

                .aa-special-overlay { position:fixed; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:2147483648; animation: broadcastFadeIn 0.3s ease; }
                .aa-special-card { position:relative; width:min(95vw,720px); max-width:95vw; padding:24px; border-radius:28px; overflow:hidden; background:rgba(10,10,18,0.96); box-shadow:0 0 80px rgba(0,0,0,0.75), inset 0 0 16px rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:#fff; transform:translateZ(0); pointer-events:auto; }
                .aa-special-card.aa-safe-card { background:linear-gradient(180deg, #3f3b1f, #141217); border-color:#ffd73a; min-height:min(85vw,600px); }
                .aa-special-card.aa-pig-card { background:linear-gradient(180deg, #5f3e00, #1b0f00); border-color:#ffd166; }
                .aa-special-title { margin:0 0 14px; font-size:2.1rem; letter-spacing:1px; text-transform:uppercase; color:#ffd700; text-shadow:0 0 25px rgba(255,206,0,0.5); }
                .aa-special-subtitle { margin:0; color:#f0f0f0; opacity:0.9; }
                .aa-special-code { margin:18px 0 8px; font-size:1.2rem; letter-spacing:0.05em; }
                .aa-special-code strong { color:#fff; display:block; margin-top:4px; font-size:1.6rem; }
                .aa-special-value { color:#ffd700; margin-bottom:12px; font-weight:900; }
                .aa-special-message { color:#d6d6d6; line-height:1.55; }
                .aa-popup-close { position:absolute; top:16px; right:16px; width:auto; min-width:68px; height:36px; padding:0 14px; border:none; border-radius:18px; background:rgba(255,255,255,0.96) !important; color:#000 !important; font-weight:900; font-size:1rem; line-height:36px; text-transform:none; cursor:pointer; backdrop-filter:blur(6px); box-shadow:0 5px 18px rgba(0,0,0,0.35); transition: transform 0.2s, background 0.2s; pointer-events:auto; }
                .aa-popup-close:hover { transform: scale(1.05); background:rgba(255,255,255,1) !important; }
                .aa-safe-shell {
                    position:absolute; left:50%; top:50%; width:clamp(260px, 68vw, 520px); height:clamp(260px, 68vw, 520px);
                    transform: translate(-50%, -50%);
                    border-radius:50%; overflow:hidden;
                    background: radial-gradient(circle at 30% 25%, #f4f7fb 0%, #b7bcc4 20%, #7b8390 55%, #323940 100%);
                    border:4px solid rgba(255,255,255,0.18);
                    box-shadow: inset 0 0 36px rgba(255,255,255,0.15), 0 26px 70px rgba(0,0,0,0.4);
                    perspective:1200px;
                }
                .aa-safe-shell::before {
                    content:''; position:absolute; inset:12px; border-radius:50%;
                    border:2px solid rgba(255,255,255,0.08);
                    box-shadow: inset 0 0 20px rgba(255,255,255,0.12);
                }
                .aa-safe-door {
                    position:absolute; left:50%; top:50%; width:84%; height:84%;
                    border-radius:50%; background: radial-gradient(circle at 35% 35%, #eaeff2 0%, #bcc6d0 28%, #8f98a2 58%, #3c454d 100%);
                    border:10px solid rgba(255,255,255,0.22);
                    box-shadow: inset 0 0 22px rgba(255,255,255,0.12), inset 0 -10px 20px rgba(0,0,0,0.18), 0 20px 48px rgba(0,0,0,0.35);
                    transform:translate(-50%, -50%) rotateY(0deg);
                    transform-origin:left center;
                    transform-style:preserve-3d;
                    backface-visibility:hidden;
                    animation: aaSafeDoorOpen 2.4s cubic-bezier(0.16,1,0.3,1) forwards 0.6s;
                    z-index:1;
                    max-width:420px;
                    max-height:420px;
                    min-width:180px;
                    min-height:180px;
                }
                .aa-safe-door::before {
                    content:''; position:absolute; inset:16px; border-radius:50%;
                    background:rgba(255,255,255,0.06);
                    box-shadow: inset 0 0 20px rgba(255,255,255,0.08);
                }
                .aa-safe-door::after {
                    content:''; position:absolute; top:18px; right:18px; width:16px; height:34px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.2));
                    border-radius:10px;
                    box-shadow: 0 0 6px rgba(255,255,255,0.25);
                    transform: translateZ(5px);
                }
                .aa-safe-dial {
                    position:absolute; left:50%; top:50%; width:110px; height:110px;
                    transform:translate(-50%, -50%); border-radius:50%;
                    background: radial-gradient(circle at 50% 50%, #f9fbfd 0%, #cdd4dc 40%, #a3abb4 65%, #5b6470 100%),
                                repeating-conic-gradient(from 0deg, rgba(255,255,255,0.18) 0deg 6deg, transparent 6deg 12deg);
                    border:5px solid rgba(34,34,34,0.16);
                    box-shadow: inset 0 6px 18px rgba(255,255,255,0.55), 0 0 18px rgba(0,0,0,0.2);
                    animation: aaSafeDialSpin 1.4s cubic-bezier(0.22,0.9,0.36,1) forwards;
                }
                .aa-safe-dial::before {
                    content:''; position:absolute; left:50%; top:50%; width:24px; height:24px; border-radius:50%;
                    transform:translate(-50%, -50%);
                    background: radial-gradient(circle at 35% 35%, #fff 0%, #d8dde3 45%, #8a9099 100%);
                    box-shadow: inset 0 0 8px rgba(255,255,255,0.85);
                }
                .aa-safe-dial::after {
                    content:''; position:absolute; left:50%; top:50%; width:6px; height:48px;
                    transform:translate(-50%, -90%); border-radius:4px;
                    background: rgba(35,35,35,0.92); box-shadow: 0 0 6px rgba(0,0,0,0.35);
                }
                .aa-safe-fog { position:absolute; left:50%; top:46%; width:260px; height:220px; transform:translateX(-50%); pointer-events:none; animation: aaFogRise 1.2s ease forwards 0.8s; z-index:0; }
                .aa-safe-code { position:absolute; left:50%; bottom:22px; transform:translateX(-50%) scale(0.92); opacity:0; color:#fff; font-size:1rem; letter-spacing:0.08em; text-transform:uppercase; border:1px solid rgba(255,255,255,0.16); backdrop-filter:blur(10px); background:rgba(0,0,0,0.35); padding:10px 18px; border-radius:999px; transition:opacity 0.35s ease, transform 0.35s ease; pointer-events:none; }
                .aa-safe-code.aa-code-visible { opacity:1; transform:translateX(-50%) scale(1); }
                .aa-safe-fog::before, .aa-safe-fog::after { content:''; position:absolute; left:50%; width:160px; height:120px; background:rgba(255,255,255,0.24); border-radius:50%; filter:blur(16px); transform:translateX(-50%); }
                .aa-safe-fog::before { top:12px; }
                .aa-safe-fog::after { top:70px; width:220px; opacity:0.18; }
                .aa-pig-graphic { display:inline-flex; align-items:center; justify-content:center; width:112px; height:112px; margin:0 auto 18px; border-radius:50%; background:radial-gradient(circle at 30% 25%, #fff5b7 0%, #ffd066 35%, #d48c21 70%, #a36508 100%); box-shadow: inset 0 0 30px rgba(255,255,255,0.35), 0 18px 40px rgba(0,0,0,0.35); font-size:3rem; color:#fff; text-shadow: 0 4px 18px rgba(0,0,0,0.25); animation: aaPigBounce 1.4s ease-in-out infinite; }
                .aa-diamond { position:absolute; width:18px; height:18px; background:linear-gradient(135deg, #f6f7ff 0%, #a7ecff 30%, #5fd0ff 60%, #3b94ff 100%); border:1px solid rgba(255,255,255,0.8); border-radius:4px; transform:rotate(45deg); box-shadow:0 0 18px rgba(126,219,255,0.85), inset 0 0 4px rgba(255,255,255,0.7); }
                .aa-diamond::after { content:''; position:absolute; inset:4px; background:rgba(255,255,255,0.45); border-radius:2px; filter:blur(0.2px); }
                .aa-wing-code { position:absolute; display:flex; align-items:center; justify-content:center; gap:8px; min-width:120px; padding:10px 16px; border-radius:999px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.22); color:#fff; font-size:0.95rem; text-transform:uppercase; backdrop-filter:blur(6px); animation: aaWingFlight 8s linear infinite; box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
                .aa-wing-code .aa-wing { display:inline-block; font-size:1.2rem; animation: aaWingFlap 1s ease-in-out infinite alternate; }
                .aa-special-fadeout { animation: broadcastFadeOut 0.5s ease forwards; }
                @keyframes broadcastFadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes broadcastFadeOut { from { opacity:1; } to { opacity:0; } }
                @keyframes aaSafeDoorOpen { 0% { transform: translate(-50%, -50%) rotateY(0deg); } 40% { transform: translate(-50%, -50%) rotateY(-18deg); } 100% { transform: translate(-50%, -50%) rotateY(-115deg); } }
                @keyframes aaSafeDialSpin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 30% { transform: translate(-50%, -50%) rotate(1440deg); } 60% { transform: translate(-50%, -50%) rotate(1020deg); } 100% { transform: translate(-50%, -50%) rotate(1260deg); } }
                @keyframes aaFogRise { 0% { opacity:0; transform: translate(-50%, 10px) scale(0.8); } 100% { opacity:1; transform: translate(-50%, -30px) scale(1.05); } }
                @keyframes aaPigBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
                @keyframes aaDiamondFloat { 0% { transform: translateY(0) scale(0.8) rotate(0deg); opacity:0; } 10% { opacity:1; } 50% { transform: translateY(-36px) scale(1.1) rotate(20deg); } 100% { transform: translateY(-80px) scale(0.9) rotate(40deg); opacity:0; } }
                @keyframes aaWingFlight { 0% { transform: translateX(0) translateY(0); opacity:0; } 10% { opacity:1; } 50% { transform: translateX(280px) translateY(-20px); } 100% { transform: translateX(560px) translateY(0); opacity:0; } }
                @keyframes aaWingFlap { from { transform: rotate(0deg) translateY(0); } to { transform: rotate(8deg) translateY(-2px); } }
            `;
            document.head.appendChild(style);
        }
        const overlay = document.createElement('div');
        overlay.className = 'broadcast-popup-overlay';
        overlay.innerHTML = `<div class="broadcast-popup-content"><h3>📢 Message from Admin</h3><p>${message}</p><button disabled>Close in 5s</button></div>`;
        document.body.appendChild(overlay);
        
        const btn = overlay.querySelector('button');
        let timeLeft = 5;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timer);
                btn.innerText = "Close";
                btn.disabled = false;
            } else {
                btn.innerText = `Close in ${timeLeft}s`;
            }
        }, 1000);

        btn.onclick = () => overlay.remove();
    }

    // --- PRE-INIT CHECKS ---
    const featureEnabled = localStorage.getItem('sidebar_feature_enabled') !== 'false';
    if (!featureEnabled) {
        console.log("Sidebar feature is disabled.");
        return;
    }
    console.log("Sidebar script starting...");

    // --- INJECT STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        :root { --sidebar-accent: #45ffbc; --sidebar-bg: rgba(18, 18, 18, 0.85); --sidebar-widget-bg: rgba(255, 255, 255, 0.06); }
        #fs-sidebar {
            position: fixed; top: 0; left: 0; height: 100%; width: 340px;
            background: var(--sidebar-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            transform: translateX(-100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 2147483646; display: flex; flex-direction: column;
            border-right: 1px solid rgba(255,255,255,0.1); box-shadow: 10px 0 30px rgba(0,0,0,0.5);
            color: #eee; font-family: 'Be Vietnam Pro', sans-serif;
        }
        #fs-sidebar.open { transform: translateX(0); }
        #fs-sidebar.minimised { transform: translateX(-100%); }
        #fs-sidebar-peek {
            position: fixed; top: 50%; left: 0; transform: translateY(-50%);
            width: 28px; height: 64px; background: rgba(30,30,30,0.95);
            border: 1px solid rgba(255,255,255,0.2); border-left: none;
            border-top-right-radius: 12px; border-bottom-right-radius: 12px;
            backdrop-filter: blur(8px); cursor: pointer;
            display: none; align-items: center; justify-content: center;
            color: var(--sidebar-accent,#45ffbc); font-size: 1.1rem; font-weight: bold;
            box-shadow: 4px 0 16px rgba(0,0,0,0.6);
            z-index: 2147483647; transition: width 0.2s, background 0.2s;
        }
        #fs-sidebar-peek.visible { display: flex; }
        #fs-sidebar-peek:hover { width: 36px; background: rgba(60,60,60,0.98); }
        #fs-sidebar.detached { height: auto; max-height: 85vh; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); bottom: auto; transform: none !important; transition: opacity 0.2s; }
        #fs-sidebar.detached:not(.open) { display: none; }
        #fs-sidebar-toggle {
            position: fixed; top: 50%; left: 0; transform: translateY(-50%);
            width: 30px; height: 60px; background: rgba(30,30,30,0.8);
            border: 1px solid rgba(255,255,255,0.2); border-left: none;
            border-top-right-radius: 12px; border-bottom-right-radius: 12px;
            backdrop-filter: blur(5px);
            cursor: pointer; z-index: 2147483647; display: none;
            align-items: center; justify-content: center; color: var(--sidebar-accent);
            box-shadow: 4px 0 10px rgba(0,0,0,0.3); transition: all 0.2s;
        }
        #fs-sidebar-toggle:hover { background: var(--sidebar-accent); color: #000; width: 35px; }
        .sidebar-header { padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 800; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); cursor: move; user-select: none; letter-spacing: 0.5px; }
        .sidebar-header-controls { display: flex; align-items: center; gap: 10px; cursor: default; }
        .sidebar-header-btn { background:none; border:none; color: #aaa; cursor:pointer; font-size:1.4rem; padding: 0 5px; transition: color 0.2s; display:flex; align-items:center; }
        .sidebar-header-btn:hover { color: white; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 20px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
        
        /* Liquid Glass Widget Style */
        .widget { 
            background: var(--sidebar-widget-bg); 
            border-radius: 16px; 
            margin-bottom: 25px; 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); 
            transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
            overflow: hidden;
        }
        .widget:hover {
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            border-color: rgba(255, 255, 255, 0.2);
        }
        .widget h4 { 
            margin: 0; padding: 12px 15px; 
            font-size: 0.85rem; color: var(--sidebar-accent); 
            border-bottom: 1px solid rgba(255, 255, 255, 0.05); 
            text-transform: uppercase; letter-spacing: 1px; font-weight: 700;
            display: flex; justify-content: space-between; align-items: center; cursor: grab; 
            background: rgba(0,0,0,0.2);
        }
        .widget h4:active { cursor: grabbing; }
        .widget-content { padding: 15px; transition: all 0.3s ease-in-out; overflow: hidden; max-height: 500px; }
        .widget.collapsed .widget-content { max-height: 0; padding: 0 10px; opacity: 0; }
        .widget.dragging { 
            opacity: 0.6; 
            transform: scale(0.98) rotate(1deg); 
            box-shadow: 0 15px 30px rgba(0,0,0,0.4); 
            cursor: grabbing;
            border-color: var(--sidebar-accent);
        }
        .drag-over-placeholder { height: 60px; background: rgba(69, 255, 188, 0.05); border: 2px dashed rgba(69, 255, 188, 0.3); border-radius: 16px; margin-bottom: 25px; }
        
        /* Organize Panel */
        #fs-organize-panel { display: none; padding: 20px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.1); max-height: 60vh; overflow-y: auto; }
        #fs-organize-panel h5 { margin: 0 0 15px 0; color: var(--sidebar-accent); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .organize-list-item { 
            display: flex; align-items: center; justify-content: space-between; 
            margin-bottom: 8px; font-size: 0.9rem; 
            background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 8px;
            border: 1px solid transparent; transition: background 0.2s;
        }
        .organize-list-item:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.1); }
        .organize-btn {
            border: none; border-radius: 6px; width: 28px; height: 28px; 
            display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold;
        }
        .btn-add-widget { background: var(--sidebar-accent); color: #000; }
        .btn-remove-widget { background: rgba(255,255,255,0.1); color: #aaa; }
        .btn-remove-widget:hover { background: #ff5252; color: white; }

        /* Inputs & Buttons */
        textarea.notes-area { width: 100%; height: 120px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ddd; resize: vertical; padding: 10px; border-radius: 8px; font-family: monospace; outline: none; }
        textarea.notes-area:focus { border-color: var(--sidebar-accent); }
        .sidebar-btn { width: 100%; margin-top: 8px; background: var(--sidebar-accent); border: none; cursor: pointer; padding: 10px; border-radius: 8px; font-weight: bold; color: #000; transition: filter 0.2s; }
        .sidebar-btn:hover { background: #34e3a5; }
        .calc-display { background: rgba(0,0,0,0.4); color: var(--sidebar-accent); padding: 12px; font-family: monospace; font-size: 1.4rem; text-align: right; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1); min-height: 45px; }
        .calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
        .calc-btn { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        .calc-btn:hover { background: rgba(255,255,255,0.2); }
        .calc-btn:active { background: var(--sidebar-accent); color: black; }
        .todo-item { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 10px; margin-bottom: 6px; border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.05); }
        .todo-item.done span { text-decoration: line-through; opacity: 0.6; }
        
        /* New Widget Styles */
        .notes-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
        .note-tab-btn { background: rgba(255,255,255,0.1); border: none; color: #aaa; padding: 5px 10px; border-radius: 6px; cursor: pointer; }
        .note-tab-btn.active { background: var(--sidebar-accent); color: #000; font-weight: bold; }
        .converter-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
        .converter-input, .converter-select { width: 100%; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; }
        .weather-today { text-align: center; margin-bottom: 15px; }
        .weather-today .icon { font-size: 4rem; }
        .weather-today .temp { font-size: 2.5rem; font-weight: 700; }
        .weather-details { display: flex; justify-content: space-around; font-size: 0.8rem; color: #ccc; margin-top: 10px; }
        .weather-forecast { display: flex; justify-content: space-between; gap: 5px; text-align: center; font-size: 0.8rem; }
        .forecast-day { flex: 1; background: rgba(0,0,0,0.2); padding: 10px 4px; border-radius: 8px; }
        .forecast-day .icon { font-size: 2.2rem; margin: 5px 0; }
        .weather-location { text-align: center; font-size: 1.2rem; font-weight: bold; color: var(--sidebar-accent); margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }

        /* Pomodoro */
        .pomo-timer { font-size: 2.5rem; font-weight: bold; text-align: center; margin: 10px 0; font-variant-numeric: tabular-nums; }
        .pomo-status { text-align: center; color: #aaa; font-size: 0.9rem; margin-bottom: 5px; }
        
        /* Breathing */
        .breath-circle { width: 80px; height: 80px; background: var(--sidebar-accent); border-radius: 50%; margin: 20px auto; opacity: 0.6; transform: scale(1); }
        .breath-circle.inhale { animation: breathAnim 4s infinite ease-in-out; }
        @keyframes breathAnim { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.8); opacity: 0.9; } }
        .breath-text { text-align: center; font-weight: bold; height: 20px; }

        /* Tic Tac Toe */
        .ttt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; max-width: 200px; margin: 0 auto; }
        .ttt-cell { background: rgba(255,255,255,0.1); height: 50px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; cursor: pointer; border-radius: 4px; }
        .ttt-cell:hover { background: rgba(255,255,255,0.2); }
        .ttt-status { text-align: center; margin-bottom: 10px; font-size: 0.9rem; }

        /* Dictionary */
        .dict-result { margin-top: 10px; font-size: 0.9rem; line-height: 1.4; max-height: 150px; overflow-y: auto; }
        .dict-word { font-weight: bold; color: var(--sidebar-accent); font-size: 1.1rem; }

        /* Chat Widget Resizer */
        .chat-resizer { height: 10px; background: rgba(255,255,255,0.1); cursor: ns-resize; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; }
        
        /* Chat Widget Styles */
        #overlay-room-list-clone { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
        .overlay-room-item-clone { background: #3a3d42; padding: 8px 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; cursor: pointer; border: 1px solid transparent; transition: background 0.2s; }
        .overlay-room-item-clone:hover { background: #40444b; border-color: #7289da; }
        .overlay-room-name-clone { font-weight: bold; color: #fff; }
        .overlay-room-count-clone { font-size: 0.75rem; color: #aaa; }
        #overlay-chat-view-clone { display: none; flex-direction: column; flex: 1; overflow: hidden; }
        #overlay-chat-messages-clone { flex-grow: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        #overlay-chat-input-area-clone { display: flex; padding: 8px; border-top: 1px solid #202225; flex-shrink: 0; background: #202225; gap: 6px; }
        #overlay-chat-input-clone { flex-grow: 1; resize: none; border: none; background-color: #40444b; color: white; border-radius: 4px; padding: 6px; height: 32px; font-size: 0.85rem; }
        #overlay-send-btn-clone { background-color: #5865F2; border: none; color: white; padding: 0 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; height: 32px; }
        .overlay-msg-clone { padding: 5px 8px; border-radius: 6px; max-width: 90%; word-wrap: break-word; line-height: 1.3; font-size: 0.8rem; }
        .overlay-msg-clone.self { background-color: #5865F2; align-self: flex-end; color: white; }
        .overlay-msg-clone.other { background-color: #3a3d42; align-self: flex-start; color: #dcddde; }
        .overlay-msg-sender-clone { font-size: 0.7rem; font-weight: bold; margin-bottom: 2px; color: #aaa; }
        .overlay-msg-clone.self .overlay-msg-sender-clone { display: none; }
        .overlay-msg-clone p { margin: 0; }
        .typing-indicator-clone { font-size: 0.7rem; color: #aaa; padding: 2px 8px; font-style: italic; min-height: 15px; }
        .reply-banner-clone { background: #2a2a2a; padding: 4px 8px; font-size: 0.75rem; display: flex; justify-content: space-between; border-left: 3px solid #7289da; margin-bottom: 4px; align-items: center; }
        .reply-context-clone { font-size: 0.7rem; opacity: 0.7; border-left: 2px solid #aaa; padding-left: 4px; margin-bottom: 2px; cursor: pointer; }
        .gif-btn-clone { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 0 8px; color: #ccc; }
        .gif-btn-clone:hover { color: #fff; }
        #gif-modal-clone { display: none; position: absolute; bottom: 50px; left: 0; width: 100%; height: 300px; background: #2f3136; border-top: 1px solid #444; z-index: 20; flex-direction: column; }
        #gif-search-clone { width: 100%; padding: 8px; background: #202225; border: none; color: white; outline: none; }
        #gif-results-clone { flex: 1; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 5px; padding: 5px; }
        #gif-results-clone img { width: 48%; height: auto; object-fit: cover; cursor: pointer; border-radius: 4px; }
        .overlay-msg-content-clone img.gif-img-clone { max-width: 150px; border-radius: 4px; margin-top: 4px; }
        .overlay-msg-sender-clone { cursor: pointer; }
        .overlay-msg-sender-clone:hover { text-decoration: underline; }
        .reply-btn-small-clone { font-size: 0.7rem; margin-left: 5px; cursor: pointer; opacity: 0.5; }
        .reply-btn-small-clone:hover { opacity: 1; }
        .bubble-default-clone { background-color: #5865F2 !important; color: white !important; }
        .bubble-blue-clone { background: linear-gradient(135deg, #2196f3, #21cbf3) !important; color: white !important; }
        .bubble-red-clone { background: linear-gradient(135deg, #ff5252, #ff1744) !important; color: white !important; }
        .bubble-gold-clone { background: linear-gradient(135deg, #ffd700, #ffecb3) !important; color: black !important; }
        .bubble-rainbow-clone { background: linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3) !important; color: white !important; }
        .overlay-pfp-clone { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); }
        .overlay-msg-top-clone { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .overlay-msg-clone.self .overlay-msg-top-clone { flex-direction: row-reverse; }
        .overlay-msg-meta-clone { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .overlay-badge-clone { background-color: gold; color: black; padding: 1px 3px; border-radius: 3px; font-size: 0.65rem; line-height: 1; }
        .overlay-date-clone { font-size: 0.65rem; opacity: 0.7; margin-left: 4px; }
        .overlay-msg-content-clone a { color: inherit; text-decoration: underline; }
        
        #online-users-bar-clone { background-color: #2f3136; padding: 5px 10px; border-bottom: 1px solid #202225; color: #b9bbbe; font-size: 0.75rem; display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; align-items: center; }
        .online-user-clone { display: flex; align-items: center; gap: 4px; }
        .status-dot-clone { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .status-dot-clone.active { background-color: #43b581; box-shadow: 0 0 4px #43b581; }
        .status-dot-clone.idle { background-color: #faa61a; }

        /* Sidebar Notification Toast */
        .sidebar-notification {
            background: rgba(30, 30, 30, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px;
            color: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 12px;
            width: 300px;
            animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            cursor: pointer;
            font-family: 'Be Vietnam Pro', sans-serif;
            pointer-events: auto;
            margin-top: 10px;
            overflow: hidden; /* For shine effect */
            position: relative;
        }
        .sidebar-notification::before {
            content: '🌟';
            position: absolute;
            top: -2px;
            left: -2px;
            font-size: 2rem;
            z-index: 10;
            animation: starPop 0.6s ease-out forwards;
        }
        @keyframes starPop {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }
        .sidebar-notification::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
            transform: rotate(45deg);
            animation: sparkle 0.8s ease-in-out forwards;
            pointer-events: none;
            opacity: 0; /* Start hidden */
        }
        @keyframes sparkle {
            0% { transform: translate(-75%, -75%) rotate(45deg); opacity: 1; }
            99% { transform: translate(75%, 75%) rotate(45deg); opacity: 1; }
            100% { opacity: 0; }
        }
        .sidebar-notification.hiding {
            animation: fadeOutRight 0.3s ease-in forwards;
        }
        /* Modal Styles for Warnings */
        .sidebar-modal-overlay {
            display: none;
            position: fixed;
            z-index: 2147483647;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.85);
            align-items: center;
            justify-content: center;
        }
        .sidebar-modal-content {
            background-color: #2f3136;
            padding: 20px;
            border: 1px solid #444;
            width: 90%;
            max-width: 500px;
            border-radius: 10px;
            color: white;
            text-align: center;
            position: relative;
        }
        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeOutRight {
            to { opacity: 0; transform: translateX(20px); }
        }
        .notif-pfp {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--sidebar-accent);
            flex-shrink: 0;
        }
        .notif-content {
            flex: 1;
            overflow: hidden;
        }
        .notif-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 2px;
        }
        .notif-sender {
            font-weight: bold;
            font-size: 0.9rem;
            color: var(--sidebar-accent);
        }
        .notif-time {
            font-size: 0.7rem;
            color: #aaa;
        }
        .notif-body {
            font-size: 0.8rem;
            color: #ddd;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
        }
        .notif-media-tag {
            font-style: italic;
            color: #80cbc4;
        }

        /* Chat Notification Badge */
        .chat-badge { background: #f04747; color: white; border-radius: 50%; padding: 2px 6px; font-size: 0.7rem; font-weight: bold; margin-left: 5px; display: none; }
        .chat-badge.visible { display: inline-block; }
        
        #empty-state-msg { text-align: center; color: #888; padding: 20px; font-style: italic; font-size: 0.9rem; }
    `;
    document.head.appendChild(style);

    // --- INJECT HTML ---
    const sidebarContainer = document.createElement('div');
    sidebarContainer.innerHTML = `
        <!-- Warning Modal -->
        <div id="warningModal" class="sidebar-modal-overlay">
          <div class="sidebar-modal-content" style="border: 2px solid #f0ad4e;">
            <h3 style="color: #f0ad4e;">⚠️ Admin Warning</h3>
            <p id="warningMessageText" style="font-size: 1.1rem; line-height: 1.5;"></p>
            <button id="warningAckBtn" class="sidebar-btn" style="background:#f0ad4e; color:#000; margin-top: 15px;">I Understand</button>
          </div>
        </div>

        <div id="fs-sidebar">
            <div class="sidebar-header">
                <span>Quick Tools</span>
                <div class="sidebar-header-controls">
                    <button id="fs-organize-toggle-btn" class="sidebar-header-btn" title="Add Widgets" style="font-size:1.6rem; font-weight:300;">+</button>
                    <button id="fs-sidebar-close" class="sidebar-header-btn" title="Minimise sidebar" style="font-size:1.1rem;">&#9664;</button>
                </div>
            </div>
            <div id="fs-organize-panel">
                <h5>Manage Widgets</h5>
                <div id="fs-widget-visibility-list"></div>
                <button id="fs-stop-customising" class="sidebar-btn" style="background:#f04747; margin-top:15px;">Stop Customising</button>
            </div>
            <div class="sidebar-content" id="fs-widget-container">
                <div id="empty-state-msg">No widgets added.<br>Click <b>+</b> to add some!</div>
                
                <div class="widget" id="widget-sysinfo">
                    <h4 draggable="true">💻 System Info<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="fs-sysinfo-content" style="font-size: 0.85rem; line-height: 1.6; color: #ccc;"></div>
                    </div>
                </div>

                <div class="widget" id="widget-quote" data-cost="200" data-name="Random Quote">
                    <h4 draggable="true">💬 Random Quote<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <blockquote id="fs-quote-text" style="margin:0; font-style:italic; color:#ddd; line-height:1.4; border-left: 3px solid var(--sidebar-accent); padding-left: 10px;">Loading...</blockquote>
                        <div id="fs-quote-author" style="text-align:right; margin-top:8px; font-weight:bold; color:var(--sidebar-accent); font-size: 0.9rem;"></div>
                        <button id="fs-new-quote" class="sidebar-btn" style="margin-top:12px; font-size:0.8rem; padding:6px;">New Quote</button>
                    </div>
                </div>

                <div class="widget" id="widget-calc" data-name="Calculator">
                    <h4 draggable="true">🧮 Calculator<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div class="calc-display">0</div>
                        <div class="calc-grid">
                            <button class="calc-btn">C</button><button class="calc-btn">/</button><button class="calc-btn">*</button><button class="calc-btn">-</button>
                            <button class="calc-btn">7</button><button class="calc-btn">8</button><button class="calc-btn">9</button><button class="calc-btn">+</button>
                            <button class="calc-btn">4</button><button class="calc-btn">5</button><button class="calc-btn">6</button><button class="calc-btn">=</button>
                            <button class="calc-btn">1</button><button class="calc-btn">2</button><button class="calc-btn">3</button><button class="calc-btn">0</button>
                        </div>
                    </div>
                </div>
                <div class="widget" id="widget-todo" data-name="To-Do List">
                    <h4 draggable="true">📋 To-Do List<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <input type="text" id="fs-todo-input" placeholder="Add task..." style="flex:1; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white;">
                            <button id="fs-todo-add" style="background:var(--sidebar-accent); border:none; border-radius:6px; cursor:pointer; font-weight:bold; padding:0 12px;">+</button>
                        </div>
                        <ul id="fs-todo-list" style="list-style:none; padding:0; margin:0; max-height: 150px; overflow-y: auto;"></ul>
                    </div>
                </div>
                <div class="widget" id="widget-stopwatch" data-cost="200" data-name="Stopwatch">
                    <h4 draggable="true">⏱️ Stopwatch<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="fs-stopwatch-display" class="calc-display" style="text-align:center;">00:00:00.0</div>
                        <div style="display:flex; gap:5px;">
                            <button id="fs-sw-start" class="sidebar-btn">Start</button>
                            <button id="fs-sw-stop" class="sidebar-btn" style="background:#ff5252;">Stop</button>
                            <button id="fs-sw-reset" class="sidebar-btn" style="background:#444; color:white;">Reset</button>
                        </div>
                    </div>
                </div>
                <div class="widget" id="widget-weather" data-cost="200" data-name="Weather">
                    <h4 draggable="true">🌦️ Weather<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="fs-weather" class="weather-display">
                            <button id="fs-get-weather" class="sidebar-btn" style="margin-top:0;">Get Local Weather</button>
                        </div>
                    </div>
                </div>
                <div class="widget" id="widget-notes" data-name="Notes">
                    <h4 draggable="true">📝 Notes<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div class="notes-tabs">
                            <button class="note-tab-btn active" data-page="1">Page 1</button>
                            <button class="note-tab-btn" data-page="2">Page 2</button>
                            <button class="note-tab-btn" data-page="3">Page 3</button>
                        </div>
                        <textarea id="fs-notes" class="notes-area" placeholder="Type notes for Page 1..."></textarea>
                    </div>
                </div>
                <div class="widget" id="widget-converter" data-cost="200" data-name="Unit Converter">
                    <h4 draggable="true">🔄 Unit Converter<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <select id="converter-type" class="converter-select" style="margin-bottom: 10px;"></select>
                        <div class="converter-grid">
                            <div><input type="number" id="converter-input" class="converter-input"><select id="converter-from" class="converter-select"></select></div>
                            <span>=</span>
                            <div><input type="number" id="converter-output" class="converter-input" readonly><select id="converter-to" class="converter-select"></select></div>
                        </div>
                    </div>
                </div>
                <div class="widget" id="widget-settings" data-cost="200" data-name="Appearance">
                    <h4 draggable="true">🎨 Appearance<button class="widget-toggle">-</button></h4>
                    <div class="widget-content" id="appearance-content">
                        <div style="margin-bottom:10px;">
                            <label style="display:block;font-size:0.8rem;color:#aaa;margin-bottom:5px;">Background Color</label>
                            <input type="color" id="fs-bg-color" value="#121212" style="width:100%; height:35px; border:none; padding:0; background:none; cursor:pointer;">
                        </div>
                        <div>
                            <label style="display:block;font-size:0.8rem;color:#aaa;margin-bottom:5px;">Transparency: <span id="fs-opacity-val">85%</span></label>
                            <input type="range" id="fs-bg-opacity" min="0" max="100" value="85" style="width:100%; cursor:pointer;" oninput="updateTransparencyValue(this.value)">
                        </div>
                        <button id="fs-reset-theme" class="sidebar-btn" style="background:rgba(255,255,255,0.1); color:#fff; margin-top:15px; font-size:0.8rem;">Reset Default</button>
                        <div style="margin-bottom:10px;">
                            <label style="display:block;font-size:0.8rem;color:#aaa;margin-bottom:5px;">Dashboard Accent Color</label>
                            <select id="accentColorSelect" style="width: 100%; margin-bottom: 8px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;"></select>
                        </div>
                    </div>
                </div>
                
                <div class="widget" id="widget-pomodoro" data-cost="200" data-name="Pomodoro Timer">
                    <h4 draggable="true">🍅 Pomodoro<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="pomo-status" class="pomo-status">Work Time</div>
                        <div id="pomo-timer" class="pomo-timer">25:00</div>
                        <div style="display:flex; gap:5px;">
                            <button id="pomo-start" class="sidebar-btn">Start</button>
                            <button id="pomo-reset" class="sidebar-btn" style="background:#444; color:white;">Reset</button>
                        </div>
                    </div>
                </div>

                <div class="widget" id="widget-breathing" data-cost="200" data-name="Breathing">
                    <h4 draggable="true">🧘 Breathing<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="breath-text" class="breath-text">Ready?</div>
                        <div id="breath-circle" class="breath-circle"></div>
                        <button id="breath-toggle" class="sidebar-btn">Start Exercise</button>
                    </div>
                </div>

                <div class="widget" id="widget-tictactoe" data-cost="200" data-name="Tic-Tac-Toe">
                    <h4 draggable="true">❌ Tic-Tac-Toe ⭕<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div id="ttt-status" class="ttt-status">Player X's Turn</div>
                        <div id="ttt-grid" class="ttt-grid"></div>
                        <button id="ttt-reset" class="sidebar-btn" style="margin-top:10px;">Restart Game</button>
                    </div>
                </div>

                <div class="widget" id="widget-dictionary" data-cost="200" data-name="Dictionary">
                    <h4 draggable="true">📖 Dictionary<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <div style="display:flex; gap:5px;">
                            <input type="text" id="dict-input" class="converter-input" placeholder="Word...">
                            <button id="dict-search" class="sidebar-btn" style="margin-top:0; width:auto;">🔍</button>
                        </div>
                        <div id="dict-result" class="dict-result"></div>
                    </div>
                </div>

                <div class="widget" id="widget-chat" data-cost="250" data-name="Chat">
                    <h4 draggable="true">💬 Chat <span id="chat-widget-badge" class="chat-badge">0</span><button class="widget-toggle">-</button></h4>
                    <div class="widget-content" id="chat-widget-content" style="padding:0; display:flex; flex-direction:column; height: 400px; resize: vertical; overflow: hidden;">
                        <div id="chat-header-clone" style="padding: 10px 15px; background-color: #202225; display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center;">
                                <button id="chat-back-btn-clone" style="display:none; background: none; border: none; color: #ccc; font-size: 1.2rem; cursor: pointer; margin-right: 10px;">&lt;</button>
                                <h3 id="chat-header-title-clone" style="margin:0; font-size:1rem; color:#fff;">Rooms</h3>
                            </div>
                        </div>
                        <div id="overlay-room-list-clone" style="flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 5px;"></div>
                        <div id="overlay-chat-view-clone" style="display: none; flex-direction: column; flex: 1; overflow: hidden;">
                            <div id="online-users-bar-clone"></div>
                            <div id="overlay-chat-messages-clone" style="flex-grow: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px;"></div>
                            <div id="typing-indicator-clone" class="typing-indicator-clone" style="display:none;"></div>
                            <div id="reply-banner-clone" class="reply-banner-clone" style="display:none;">
                                <span id="reply-text-clone">Replying...</span>
                                <button id="cancel-reply-btn-clone" style="background:none;border:none;color:#fff;">✕</button>
                            </div>
                            <div id="gif-modal-clone">
                                <div style="display:flex; padding:5px; background:#202225;"><input id="gif-search-clone" placeholder="Search GIFs..."><button id="close-gif-btn-clone" style="background:none;border:none;color:#fff;margin-left:5px;">✕</button></div>
                                <div id="gif-results-clone"></div>
                            </div>
                            <div id="overlay-chat-input-area-clone" style="display: flex; padding: 8px; border-top: 1px solid #202225; background: #202225; gap: 6px;">
                                <button id="gif-btn-clone" class="gif-btn-clone" title="GIFs">GIF</button>
                                <textarea id="overlay-chat-input-clone" placeholder="Message..."></textarea>
                                <button id="overlay-send-btn-clone">Send</button>
                            </div>
                        </div>
                        <div class="chat-resizer" id="chat-widget-resizer"></div>
                    </div>
                </div>

                <div class="widget" id="widget-game" data-cost="200" data-name="Mini Games">
                    <h4 draggable="true">🎮 Mini Game<button class="widget-toggle">-</button></h4>
                    <div class="widget-content">
                        <select id="fs-game-select" style="width: 100%; margin-bottom: 8px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
                            <option value="2048waffles.html">2048 Waffles</option>
                            <option value="flappywaffle.html">Flappy Waffle</option>
                            <option value="snake.html">Snake</option>
                            <option value="snowrider.html">Snow Rider 3D</option>
                            <option value="waffleclicker.html">Waffle Clicker</option>
                            <option value="waffletower.html">Waffle Tower</option>
                            <option value="wafflebreaker.html">Waffle Breaker</option>
                        </select>
                        <iframe id="fs-game-frame" style="width: 100%; height: 350px; border: none; background: #000; border-radius: 8px;"></iframe>
                        <button id="fs-play-btn" class="sidebar-btn">Load Game</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="fs-sidebar-toggle">&#9654;</div>
    `;
    document.body.appendChild(sidebarContainer);
    const _peekEl = document.createElement('div');
    _peekEl.id = 'fs-sidebar-peek';
    _peekEl.title = 'Expand sidebar';
    _peekEl.innerHTML = '&#9654;';
    document.body.appendChild(_peekEl);
    console.log("Sidebar elements appended to body.");

    // --- GLOBAL MODAL/BAN/WARN LOGIC ---
    window.closeModal = function(id) {
        const modal = document.getElementById(id);
        if (!modal) return;

        // This is a generic way to handle closing modals with an animation
        // It assumes a 'closing' class triggers an animation in CSS
        if (modal.classList.contains('modal')) { // A convention for animated modals
            modal.classList.add('closing');
            const content = modal.querySelector('.modal-content');
            // Listen on the modal itself as a fallback if no .modal-content
            (content || modal).addEventListener('animationend', () => {
                modal.style.display = "none";
                modal.classList.remove('closing');
            }, { once: true });
        } else {
            modal.style.display = 'none';
        }
    }

    window.triggerBan = function(code, reason) {
        if (document.getElementById('ban-overlay')) return;
        const banInfo = { code: code || 'ERROR', reason: reason || 'Access Denied.' };
        // Write ban to Firebase so it persists across every refresh
        const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
        if (user) {
            firebase.database().ref('users/' + user.uid + '/ban').set(banInfo).catch(function(){});
            firebase.database().ref('cheat_logs').push({
                uid: user.uid,
                email: user.email || 'unknown',
                details: 'Auto-ban. Code: ' + code + '. Reason: ' + reason,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).catch(function(){});
        }

        const overlay = document.createElement('div');
        overlay.id = 'ban-overlay';
        overlay.innerHTML = `
            <style>
                #ban-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999999; background: #000; color: #ff0000; font-family: 'Courier New', monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
                .glitch-wrapper { position: relative; margin-bottom: 20px; }
                .glitch { font-size: 8rem; font-weight: bold; text-transform: uppercase; position: relative; text-shadow: 0.05em 0 0 #00ff00, -0.025em -0.05em 0 #ff00ff, 0.025em 0.05em 0 #00ffff; animation: glitch-anim 1s infinite linear alternate-reverse; }
                .glitch::before, .glitch::after { content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; }
                .glitch::before { left: 2px; text-shadow: -2px 0 #00ff00; clip: rect(44px, 450px, 56px, 0); animation: glitch-anim-2 5s infinite linear alternate-reverse; }
                .glitch::after { left: -2px; text-shadow: -2px 0 #ff00ff, 2px 2px #00ffff; clip: rect(85px, 450px, 90px, 0); animation: glitch-anim-1 3s infinite linear alternate-reverse; }
                @keyframes glitch-anim { 0% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 2px); } 80% { transform: translate(2px, -2px); } 100% { transform: translate(0); } }
                @keyframes glitch-anim-1 { 0% { clip: rect(20px, 9999px, 80px, 0); } 20% { clip: rect(60px, 9999px, 10px, 0); } 40% { clip: rect(90px, 9999px, 50px, 0); } 60% { clip: rect(10px, 9999px, 90px, 0); } 80% { clip: rect(50px, 9999px, 20px, 0); } 100% { clip: rect(30px, 9999px, 70px, 0); } }
                @keyframes glitch-anim-2 { 0% { clip: rect(90px, 9999px, 10px, 0); } 20% { clip: rect(10px, 9999px, 60px, 0); } 40% { clip: rect(50px, 9999px, 90px, 0); } 60% { clip: rect(80px, 9999px, 20px, 0); } 80% { clip: rect(20px, 9999px, 50px, 0); } 100% { clip: rect(70px, 9999px, 30px, 0); } }
                .reason { font-size: 2.5rem; margin: 20px 0; text-shadow: 0 0 10px #ff0000; }
            </style>
            <div class="glitch-wrapper"><div class="glitch" data-text="BANNED">${banInfo.code} BANNED</div></div>
            <div class="reason">CODE: ${banInfo.code}<br>${banInfo.reason}</div>
        `;
        const hideStyle = document.createElement('style');
        hideStyle.id = 'ban-hide-style';
        hideStyle.textContent = 'body > *:not(#ban-overlay) { display: none !important; }';
        document.head.appendChild(hideStyle);
        document.body.appendChild(overlay);
    }

    function listenForWarnings(uid) {
        if (typeof firebase === 'undefined') return;
        const warningsRef = firebase.database().ref('user_warnings/' + uid);
        warningsRef.on('child_added', snap => {
            const warning = snap.val();
            if (warning && warning.message) {
                showWarningPopup(warning.message, () => {
                    snap.ref.remove();
                });
            }
        });
    }

    function showWarningPopup(message, onAcknowledge) {
        const modal = document.getElementById('warningModal');
        if (!modal) return;
        document.getElementById('warningMessageText').innerText = message;
        const ackBtn = document.getElementById('warningAckBtn');
        const newAckBtn = ackBtn.cloneNode(true);
        ackBtn.parentNode.replaceChild(newAckBtn, ackBtn);
        newAckBtn.onclick = () => {
            closeModal('warningModal');
            if (typeof onAcknowledge === 'function') onAcknowledge();
        };
        modal.style.display = 'flex';
    }

    // --- ELEMENT REFERENCES ---
    const sidebar = document.getElementById('fs-sidebar');
    const toggleBtn = document.getElementById('fs-sidebar-toggle');
    const widgetContainer = document.getElementById('fs-widget-container');
    const organizePanel = document.getElementById('fs-organize-panel');
    const visibilityList = document.getElementById('fs-widget-visibility-list');
    const emptyStateMsg = document.getElementById('empty-state-msg');

    // --- Sidebar Chat Elements ---
    let chatInitialized = false;
    let chatCurrentUser = null;
    let chatCurrentProfile = null;
    let chatCurrentOverlayRoom = null;
    let chatOverlayMsgListener = null;
    const chatHeaderTitleClone = document.getElementById('chat-header-title-clone');
    const chatBackBtnClone = document.getElementById('chat-back-btn-clone');
    const overlayRoomListClone = document.getElementById('overlay-room-list-clone');
    const overlayChatViewClone = document.getElementById('overlay-chat-view-clone');
    const overlayChatMessagesClone = document.getElementById('overlay-chat-messages-clone');
    const overlayChatInputClone = document.getElementById('overlay-chat-input-clone');
    const overlaySendBtnClone = document.getElementById('overlay-send-btn-clone');
    const typingIndicatorClone = document.getElementById('typing-indicator-clone');
    const onlineUsersBarClone = document.getElementById('online-users-bar-clone');
    const replyBannerClone = document.getElementById('reply-banner-clone');
    const replyTextClone = document.getElementById('reply-text-clone');
    const cancelReplyBtnClone = document.getElementById('cancel-reply-btn-clone');
    let chatUnreadCount = 0;


    // --- STATE & CONFIG ---
    const WIDGETS = Array.from(widgetContainer.querySelectorAll('.widget'));
    let draggedWidget = null;

    // --- Chat Widget State ---
    const gifBtnClone = document.getElementById('gif-btn-clone');
    const gifModalClone = document.getElementById('gif-modal-clone');
    const gifSearchClone = document.getElementById('gif-search-clone');
    const gifResultsClone = document.getElementById('gif-results-clone');
    const closeGifBtnClone = document.getElementById('close-gif-btn-clone');
    let chatCurrentReply = null;
    let chatTypingTimeout = null;
    let shopConfig = {};
    let badgeInfoMap = {};

    // --- LOCAL STORAGE HELPERS ---
    const getJSON = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    };
    const setJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    // --- CORE LOGIC ---
    function initializeSidebar() {
        attachEventListeners();
        loadWidgetState();
        loadSidebarState();
        loadWidgetData();
        loadChatData();
        makeChatWidgetResizable();
        initializeChatWidget();
        syncUnlockedWidgets();
    }

    function attachEventListeners() {
        // Sidebar minimise/expand
        toggleBtn.addEventListener('click', () => expandSidebar());
        sidebar.querySelector('#fs-sidebar-close').addEventListener('click', () => minimiseSidebar());
        document.getElementById('fs-sidebar-peek').addEventListener('click', () => expandSidebar());

        // Sidebar drag
        makeSidebarDraggable();

        // Widget organization
        sidebar.querySelector('#fs-organize-toggle-btn').addEventListener('click', () => {
            organizePanel.style.display = organizePanel.style.display === 'block' ? 'none' : 'block';
        });
        
        sidebar.querySelector('#fs-stop-customising').addEventListener('click', () => {
            organizePanel.style.display = 'none';
        });

        // Widget collapse, drag, and visibility
        WIDGETS.forEach(widget => {
            widget.querySelector('h4').addEventListener('dragstart', handleDragStart);
            widget.querySelector('h4').addEventListener('dragend', handleDragEnd);
            widget.querySelector('.widget-toggle').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleWidgetCollapse(widget);
            });
        });
        widgetContainer.addEventListener('dragover', handleDragOver);
        widgetContainer.addEventListener('drop', handleDrop);
    }

    // --- STATE MANAGEMENT ---
    function minimiseSidebar() {
        sidebar.classList.remove('open');
        sidebar.classList.add('minimised');
        toggleBtn.style.display = 'none';
        const peek = document.getElementById('fs-sidebar-peek');
        if (peek) peek.classList.add('visible');
        const state = getJSON('sidebar_state', {});
        state.isOpen = false;
        setJSON('sidebar_state', state);
    }

    function expandSidebar() {
        sidebar.classList.remove('minimised');
        sidebar.classList.add('open');
        toggleBtn.style.display = 'none';
        const peek = document.getElementById('fs-sidebar-peek');
        if (peek) peek.classList.remove('visible');
        const sbBadge = document.getElementById('fs-sidebar-badge');
        if (sbBadge) { sbBadge.innerText = '0'; sbBadge.style.display = 'none'; }
        const state = getJSON('sidebar_state', {});
        state.isOpen = true;
        setJSON('sidebar_state', state);
    }

    function toggleSidebar(open) {
        if (open) expandSidebar(); else minimiseSidebar();
    }

    function loadSidebarState() {
        const state = getJSON('sidebar_state', { isOpen: true, isDetached: false });
        if (state.isDetached) {
            sidebar.classList.add('detached');
            sidebar.style.top = state.top;
            sidebar.style.left = state.left;
        }
        // Respect saved state — minimised stays minimised across pages
        if (state.isOpen === false) {
            minimiseSidebar();
        } else {
            expandSidebar();
        }
    }

    function loadWidgetState() {
        // Default to ALL hidden if not set
        const allWidgetIds = WIDGETS.map(w => w.id);
        let hiddenWidgets = getJSON('sidebar_hidden_widgets', null);
        
        if (hiddenWidgets === null) {
            // First run: hide everything except maybe a few defaults? For now hide all.
            hiddenWidgets = [...allWidgetIds]; // Hide all by default
            setJSON('sidebar_hidden_widgets', hiddenWidgets);
        }

        let widgetOrder = getJSON('sidebar_widget_order', WIDGETS.map(w => w.id));
        
        // Ensure new widgets are added to the order list if they are missing
        const currentIds = WIDGETS.map(w => w.id);
        const missingIds = currentIds.filter(id => !widgetOrder.includes(id));
        if (missingIds.length > 0) {
            widgetOrder = [...widgetOrder, ...missingIds];
            setJSON('sidebar_widget_order', widgetOrder);
        }

        const collapsedWidgets = getJSON('sidebar_collapsed_widgets', []);

        // Get unlocked widgets
        const unlockedWidgets = getJSON('twc_unlocked_widgets', []);

        // Render Organize Panel
        visibilityList.innerHTML = '';
        WIDGETS.forEach(widget => {
            const isHidden = hiddenWidgets.includes(widget.id);
            const isCollapsed = collapsedWidgets.includes(widget.id);

            // Apply collapsed state
            if (isCollapsed) {
                widget.classList.add('collapsed');
                widget.querySelector('.widget-toggle').textContent = '+';
            }

            const item = document.createElement('div');
            item.className = 'organize-list-item';
            const name = widget.dataset.name || widget.querySelector('h4').innerText.replace(/<[^>]*>/g, '').replace('-', '').trim();
            const cost = widget.dataset.cost ? parseInt(widget.dataset.cost) : 0;
            const isLocked = cost > 0 && !unlockedWidgets.includes(widget.id);
            
            if (isLocked) {
                item.innerHTML = `
                    <span>${name} <span style="font-size:0.7em; color:#aaa;">(Locked)</span></span>
                    <span style="font-size:0.8em; color:#f04747;">Visit Shop</span>
                `;
            } else {
                item.innerHTML = `
                    <span>${name}</span>
                    <button class="organize-btn ${isHidden ? 'btn-add-widget' : 'btn-remove-widget'}">
                        ${isHidden ? '+' : '✕'}
                    </button>
                `;
                
                item.querySelector('button').addEventListener('click', () => {
                    toggleWidgetVisibility(widget.id, isHidden); // If hidden, we want to show (true)
                });
            }
            
            visibilityList.appendChild(item);
        });

        // Apply visibility and order
        // We need to keep the empty state msg in the DOM but hidden if widgets exist
        WIDGETS.forEach(w => w.remove()); // Detach all widgets first
        
        let visibleCount = 0;
        widgetOrder.forEach(id => {
            const widget = WIDGETS.find(w => w.id === id);
            if (widget) {
                const cost = widget.dataset.cost ? parseInt(widget.dataset.cost) : 0;
            const isWidgetLocked = cost > 0 && !unlockedWidgets.includes(widget.id);

            if (!hiddenWidgets.includes(id) && !isWidgetLocked) {
                    widget.style.display = 'block';
                    widgetContainer.appendChild(widget);
                    visibleCount++;
                } else {
                    widget.style.display = 'none';
                    // We don't append hidden widgets to keep the list clean, 
                    // but we need them in DOM for logic? 
                    // Actually, let's append them but display:none so they are there.
                    widgetContainer.appendChild(widget);
                }
            }
        });

        emptyStateMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    function toggleWidgetVisibility(widgetId, shouldShow) {
        const hiddenWidgets = getJSON('sidebar_hidden_widgets', []);
        if (shouldShow) {
            const index = hiddenWidgets.indexOf(widgetId);
            if (index > -1) hiddenWidgets.splice(index, 1);
        } else {
            if (!hiddenWidgets.includes(widgetId)) hiddenWidgets.push(widgetId);
        }
        setJSON('sidebar_hidden_widgets', hiddenWidgets);
        loadWidgetState(); // Re-render
    }

    function toggleWidgetCollapse(widget) {
        const collapsedWidgets = getJSON('sidebar_collapsed_widgets', []);
        widget.classList.toggle('collapsed');
        const isCollapsed = widget.classList.contains('collapsed');
        widget.querySelector('.widget-toggle').textContent = isCollapsed ? '+' : '-';

        if (isCollapsed) {
            if (!collapsedWidgets.includes(widget.id)) collapsedWidgets.push(widget.id);
        } else {
            const index = collapsedWidgets.indexOf(widget.id);
            if (index > -1) collapsedWidgets.splice(index, 1);
        }
        setJSON('sidebar_collapsed_widgets', collapsedWidgets);
    }

    // --- DRAG & DROP LOGIC ---
    function makeSidebarDraggable() {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = sidebar.querySelector('.sidebar-header');
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            sidebar.classList.add('detached');
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            sidebar.style.top = (sidebar.offsetTop - pos2) + "px";
            sidebar.style.left = (sidebar.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            const state = getJSON('sidebar_state', {});
            state.isDetached = true;
            state.top = sidebar.style.top;
            state.left = sidebar.style.left;
            setJSON('sidebar_state', state);
        }
    }

    function handleDragStart(e) {
        draggedWidget = e.target.closest('.widget');
        draggedWidget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(draggedWidget, 0, 0);
    }

    function handleDragEnd() {
        draggedWidget.classList.remove('dragging');
        draggedWidget = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        const afterElement = getDragAfterElement(widgetContainer, e.clientY);
        const currentPlaceholder = widgetContainer.querySelector('.drag-over-placeholder');
        if (!currentPlaceholder) {
            const placeholder = document.createElement('div');
            placeholder.className = 'drag-over-placeholder';
            if (afterElement == null) {
                widgetContainer.appendChild(placeholder);
            } else {
                widgetContainer.insertBefore(placeholder, afterElement);
            }
        } else {
            if (afterElement == null) {
                widgetContainer.appendChild(currentPlaceholder);
            } else {
                widgetContainer.insertBefore(currentPlaceholder, afterElement);
            }
        }
    }

    function getDragAfterElement(container, y) {
        // Only consider visible widgets for drag order
        const draggableElements = [...container.querySelectorAll('.widget:not(.dragging):not([style*="display: none"])')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function handleDrop(e) {
        e.preventDefault();
        const placeholder = widgetContainer.querySelector('.drag-over-placeholder');
        if (placeholder) {
            widgetContainer.insertBefore(draggedWidget, placeholder);
            placeholder.remove();
        }
        const newOrder = Array.from(widgetContainer.querySelectorAll('.widget')).map(w => w.id);
        setJSON('sidebar_widget_order', newOrder);
    }

    function getWeatherIcon(code) {
        if (code === 0) return '☀️'; // Clear sky
        if (code >= 1 && code <= 3) return '🌥️'; // Mainly clear, partly cloudy, and overcast
        if (code === 45 || code === 48) return '🌫️'; // Fog
        if (code >= 51 && code <= 57) return '🌧️'; // Drizzle
        if (code >= 61 && code <= 67) return '🌧️'; // Rain
        if (code >= 71 && code <= 77) return '❄️'; // Snow fall
        if (code >= 80 && code <= 82) return '⛈️'; // Rain showers
        if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm
        return '...';
    }

    function fetchAndRenderWeather() {
        const weatherDiv = document.getElementById('fs-weather');
        weatherDiv.innerHTML = 'Locating...';
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                weatherDiv.innerHTML = 'Loading data...';
                
                // Fetch location name first
                fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
                .then(r => r.json())
                .then(locData => {
                    const parts = [
                        locData.locality || locData.city,
                        locData.principalSubdivision,
                        locData.countryName
                    ].filter(Boolean);
                    const locationName = parts.length > 0 ? parts.join(", ") : "Unknown Location";
                    
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=7`)
                    .then(r => r.json())
                    .then(data => {
                        const current = data.current_weather;
                        const daily = data.daily;

                        const todayHtml = `
                            <div class="weather-location">📍 ${locationName}</div>
                            <div class="weather-today">
                                <div class="icon">${getWeatherIcon(current.weathercode)}</div>
                                <div class="temp">${Math.round(current.temperature)}°C</div>
                                <div class="weather-details">
                                    <span>💨 ${current.windspeed} km/h</span>
                                    <span>UV: ${daily.uv_index_max[0]}</span>
                                </div>
                            </div>
                        `;

                        let forecastHtml = '<div class="weather-forecast">';
                        for (let i = 1; i < 7; i++) {
                            const date = new Date(daily.time[i]);
                            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                            forecastHtml += `
                                <div class="forecast-day">
                                    <div>${day}</div>
                                    <div class="icon">${getWeatherIcon(daily.weathercode[i])}</div>
                                    <div><strong>${Math.round(daily.temperature_2m_max[i])}°</strong> / ${Math.round(daily.temperature_2m_min[i])}°</div>
                                </div>
                            `;
                        }
                        forecastHtml += '</div>';

                        weatherDiv.innerHTML = todayHtml + forecastHtml;
                    })
                    .catch(() => weatherDiv.innerText = "Weather error.");
                }).catch(() => weatherDiv.innerText = "Location error.");
            }, () => {
                weatherDiv.innerText = "Location access denied.";
            });
        } else {
            weatherDiv.innerText = "Geolocation not supported.";
        }
    }

    const conversionFormulas = {
        length: { m: 1, km: 1000, ft: 0.3048, mi: 1609.34 },
        weight: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 },
        temperature: {
            'C': { toBase: v => v, fromBase: v => v },
            'F': { toBase: v => (v - 32) * 5/9, fromBase: v => (v * 9/5) + 32 },
            'K': { toBase: v => v - 273.15, fromBase: v => v + 273.15 }
        }
    };

    function setupConverter() {
        const typeSelect = document.getElementById('converter-type');
        const fromSelect = document.getElementById('converter-from');
        const toSelect = document.getElementById('converter-to');
        const input = document.getElementById('converter-input');
        const output = document.getElementById('converter-output');

        const types = { Length: 'length', Weight: 'weight', Temperature: 'temperature' };
        typeSelect.innerHTML = Object.keys(types).map(t => `<option value="${types[t]}">${t}</option>`).join('');

        const updateUnits = () => {
            const type = typeSelect.value;
            const units = Object.keys(conversionFormulas[type]);
            fromSelect.innerHTML = toSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
            convert();
        };

        const convert = () => {
            const type = typeSelect.value;
            const fromUnit = fromSelect.value;
            const toUnit = toSelect.value;
            const inputValue = parseFloat(input.value);
            if (isNaN(inputValue)) { output.value = ''; return; }

            const baseValue = type === 'temperature' ? conversionFormulas[type][fromUnit].toBase(inputValue) : inputValue * conversionFormulas[type][fromUnit];
            const result = type === 'temperature' ? conversionFormulas[type][toUnit].fromBase(baseValue) : baseValue / conversionFormulas[type][toUnit];
            
            output.value = result.toFixed(2);
        };

        typeSelect.onchange = updateUnits;
        fromSelect.onchange = convert;
        toSelect.onchange = convert;
        input.oninput = convert;
        updateUnits();
    }

    function setupQuote() {
        const quoteText = document.getElementById('fs-quote-text');
        const quoteAuthor = document.getElementById('fs-quote-author');
        const newQuoteBtn = document.getElementById('fs-new-quote');

        const fetchQuote = () => {
            quoteText.innerText = "Loading...";
            quoteAuthor.innerText = "";
            fetch('https://dummyjson.com/quotes/random')
                .then(res => res.json())
                .then(data => {
                    quoteText.innerText = `"${data.quote}"`;
                    quoteAuthor.innerText = `- ${data.author}`;
                })
                .catch(() => {
                    quoteText.innerText = "Failed to fetch quote.";
                });
        };

        newQuoteBtn.addEventListener('click', fetchQuote);
        fetchQuote(); // Initial fetch
    }

    function setupThemeSettings() {
        const colorInput = document.getElementById('fs-bg-color');
        const opacityInput = document.getElementById('fs-bg-opacity');
        const opacityVal = document.getElementById('fs-opacity-val');
        const resetBtn = document.getElementById('fs-reset-theme');
        const sidebarEl = document.getElementById('fs-sidebar');

        const defaultColor = "#121212";
        const defaultOpacity = 85;

        // Load saved settings
        const savedTheme = getJSON('sidebar_theme', { color: defaultColor, opacity: defaultOpacity });
        
        if (colorInput && opacityInput) {
            colorInput.value = savedTheme.color;
            opacityInput.value = savedTheme.opacity;
            opacityVal.innerText = savedTheme.opacity + "%";
        }

        const applyTheme = (color, opacity) => {
            // Convert hex to rgb
            let r = 0, g = 0, b = 0;
            if (color.length === 4) {
                r = parseInt(color[1] + color[1], 16);
                g = parseInt(color[2] + color[2], 16);
                b = parseInt(color[3] + color[3], 16);
            } else if (color.length === 7) {
                r = parseInt(color[1] + color[2], 16);
                g = parseInt(color[3] + color[4], 16);
                b = parseInt(color[5] + color[6], 16);
            }
            const alpha = opacity / 100;
            sidebarEl.style.background = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        applyTheme(savedTheme.color, savedTheme.opacity);

        const saveTheme = () => {
            const theme = {
                color: colorInput.value,
                opacity: opacityInput.value
            };
            setJSON('sidebar_theme', theme);
            applyTheme(theme.color, theme.opacity);
            opacityVal.innerText = theme.opacity + "%";
        };

        if (colorInput) colorInput.addEventListener('input', saveTheme);
        if (opacityInput) opacityInput.addEventListener('input', saveTheme);
        
        if (resetBtn) resetBtn.addEventListener('click', () => {
            colorInput.value = defaultColor;
            opacityInput.value = defaultOpacity;
            saveTheme();
        });
    }

    // --- NEW WIDGET LOGIC ---
    function setupPomodoro() {
        const timerEl = document.getElementById('pomo-timer');
        const statusEl = document.getElementById('pomo-status');
        const startBtn = document.getElementById('pomo-start');
        const resetBtn = document.getElementById('pomo-reset');
        
        let timeLeft = 25 * 60;
        let isWork = true;
        let timerId = null;

        const format = t => {
            const m = Math.floor(t / 60).toString().padStart(2, '0');
            const s = (t % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };

        const tick = () => {
            if (timeLeft > 0) {
                timeLeft--;
                timerEl.innerText = format(timeLeft);
            } else {
                clearInterval(timerId);
                timerId = null;
                startBtn.innerText = "Start";
                isWork = !isWork;
                timeLeft = isWork ? 25 * 60 : 5 * 60;
                statusEl.innerText = isWork ? "Work Time" : "Break Time";
                timerEl.innerText = format(timeLeft);
                new Audio('Ping.mp3').play().catch(()=>{}); // Simple alert
                alert(isWork ? "Break over! Back to work." : "Work done! Take a break.");
            }
        };

        startBtn.onclick = () => {
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
                startBtn.innerText = "Resume";
            } else {
                timerId = setInterval(tick, 1000);
                startBtn.innerText = "Pause";
            }
        };

        resetBtn.onclick = () => {
            clearInterval(timerId);
            timerId = null;
            isWork = true;
            timeLeft = 25 * 60;
            statusEl.innerText = "Work Time";
            timerEl.innerText = "25:00";
            startBtn.innerText = "Start";
        };
    }

    function setupBreathing() {
        const circle = document.getElementById('breath-circle');
        const text = document.getElementById('breath-text');
        const btn = document.getElementById('breath-toggle');
        let active = false;

        btn.onclick = () => {
            active = !active;
            if (active) {
                circle.classList.add('inhale');
                btn.innerText = "Stop";
                text.innerText = "Breathe...";
            } else {
                circle.classList.remove('inhale');
                btn.innerText = "Start Exercise";
                text.innerText = "Ready?";
            }
        };
    }

    function setupTicTacToe() {
        const grid = document.getElementById('ttt-grid');
        const status = document.getElementById('ttt-status');
        const reset = document.getElementById('ttt-reset');
        let board = Array(9).fill(null);
        let xTurn = true;

        const checkWin = () => {
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            for(let c of wins) {
                if(board[c[0]] && board[c[0]] === board[c[1]] && board[c[0]] === board[c[2]]) return board[c[0]];
            }
            return board.includes(null) ? null : 'Draw';
        };

        const render = () => {
            grid.innerHTML = '';
            board.forEach((cell, i) => {
                const div = document.createElement('div');
                div.className = 'ttt-cell';
                div.innerText = cell || '';
                div.onclick = () => {
                    if(cell || checkWin()) return;
                    board[i] = xTurn ? 'X' : 'O';
                    xTurn = !xTurn;
                    const winner = checkWin();
                    if(winner) status.innerText = winner === 'Draw' ? "It's a Draw!" : `Winner: ${winner}`;
                    else status.innerText = `Player ${xTurn ? 'X' : 'O'}'s Turn`;
                    render();
                };
                grid.appendChild(div);
            });
        };
        reset.onclick = () => { board.fill(null); xTurn = true; status.innerText = "Player X's Turn"; render(); };
        render();
    }

    function setupDictionary() {
        const input = document.getElementById('dict-input');
        const btn = document.getElementById('dict-search');
        const res = document.getElementById('dict-result');
        const search = () => {
            const word = input.value.trim();
            if(!word) return;
            res.innerHTML = 'Searching...';
            fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
                .then(r => r.json())
                .then(d => {
                    if(Array.isArray(d)) {
                        const def = d[0].meanings[0].definitions[0].definition;
                        res.innerHTML = `<div class="dict-word">${d[0].word}</div><div>${def}</div>`;
                    } else {
                        res.innerHTML = "Word not found.";
                    }
                }).catch(() => res.innerHTML = "Error.");
        };
        btn.onclick = search;
        input.onkeydown = e => { if(e.key === 'Enter') search(); };
    }

    function syncUnlockedWidgets() {
        if (window.firebase) {
            const auth = firebase.auth();
            auth.onAuthStateChanged(user => {
                if (user) {
                    firebase.database().ref('users/' + user.uid + '/unlockedWidgets').on('value', snap => {
                        const unlocked = snap.val() || [];
                        setJSON('twc_unlocked_widgets', unlocked);
                        loadWidgetState(); // Refresh UI to show unlocked widgets
                    });

                    // Add global listeners for ban and warnings
                    firebase.database().ref("users/" + user.uid + "/ban").on("value", (snapshot) => {
                        const banData = snapshot.val();
                        if (banData && banData.code && banData.reason) {
                            triggerBan(banData.code, banData.reason);
                        }
                        // Do NOT clear the ban on null — dashboard.html handles unbanning via reload
                    });
                    listenForWarnings(user.uid);
                    listenForDMNotifications(user.uid);

                    // ── Write presence with properly capitalised page name ──
                    var _path = window.location.pathname.split('/').pop() || '';
                    var _page = 'Dashboard';
                    if      (_path.includes('mg.html'))       _page = 'Minigames';
                    else if (_path.includes('ch.html'))       _page = 'Chat';
                    else if (_path.includes('redeem'))        _page = 'Redeem';
                    else if (_path.includes('settings'))      _page = 'Settings';
                    else if (_path.includes('hotkeys'))       _page = 'Hotkeys';
                    else if (_path.includes('dashboard') || _path === '' || _path === 'index.html') _page = 'Dashboard';

                    var _presRef = firebase.database().ref('presence/' + user.uid);
                    _presRef.onDisconnect().set({ page: '', online: false, idle: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
                    _presRef.set({ page: _page, online: true, idle: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });

                    // Idle detection — tab hidden = idle, tab closed = offline via onDisconnect
                    document.addEventListener('visibilitychange', function() {
                        const u = firebase.auth().currentUser;
                        if (!u) return;
                        firebase.database().ref('presence/' + u.uid).update({
                            idle: document.hidden,
                            lastSeen: firebase.database.ServerValue.TIMESTAMP
                        });
                    });
                }
            });
        }
    }

    function updateChatBadge(increment) {
        const chatWidgetBadge = document.getElementById('chat-widget-badge');
        if (increment) chatUnreadCount++;
        else chatUnreadCount = 0;
        
        if (chatWidgetBadge) {
            chatWidgetBadge.innerText = chatUnreadCount;
            if (chatUnreadCount > 0) chatWidgetBadge.classList.add('visible');
            else chatWidgetBadge.classList.remove('visible');
        }
    }

    const formatDate = d => {
      const pad = n => n.toString().padStart(2, "0");
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      let hrs = d.getHours();
      const ampm = hrs < 12 ? "am" : "pm";
      hrs = hrs % 12 || 12;
      const mins = pad(d.getMinutes());
      return `${day}/${month}/${year}, ${hrs}:${mins}${ampm}`;
    };

    function loadChatData() {
        if (window.firebase) {
            const db = firebase.database();
            db.ref("config/shopItems").once("value").then(snap => {
                if (snap.exists()) shopConfig = snap.val();
            });
            db.ref("badges").once("value").then(snap => {
                if (snap.exists()) {
                    const badges = snap.val();
                    for (const id in badges) {
                        badgeInfoMap[id] = {
                            displayName: badges[id].displayName || badges[id].name || id,
                            description: badges[id].description || ""
                        };
                    }
                    // Ideally re-render messages here if they are already loaded, but for now this ensures future renders are correct.
                }
            });
        }
    }

    function makeChatWidgetResizable() {
        const resizer = document.getElementById('chat-widget-resizer');
        const chatContent = document.getElementById('chat-widget-content');
        if (!resizer || !chatContent) return;

        let startY, startHeight;

        function doDrag(e) {
            chatContent.style.height = (startHeight + e.clientY - startY) + 'px';
        }

        function stopDrag() {
            document.documentElement.removeEventListener('mousemove', doDrag, false);
            document.documentElement.removeEventListener('mouseup', stopDrag, false);
        }

        resizer.addEventListener('mousedown', function(e) {
            startY = e.clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(chatContent).height, 10);
            document.documentElement.addEventListener('mousemove', doDrag, false);
            document.documentElement.addEventListener('mouseup', stopDrag, false);
        }, false);
    }

    // --- CHAT WIDGET LOGIC ---
    function initializeChatWidget() {
        if (chatInitialized) return;
        
        if (window.firebase) {
            const auth = firebase.auth();
            auth.onAuthStateChanged(user => {
                if (user) {
                    chatCurrentUser = user;
                    firebase.database().ref('users/' + user.uid).once('value').then(snap => {
                        chatCurrentProfile = snap.val();
                        if (chatCurrentProfile) {
                            setupChatEventListeners();
                            loadOverlayRoomsClone();
                            chatInitialized = true;

                            // Auto-join saved room
                            const savedRoom = localStorage.getItem('sidebar_chat_room');
                            if (savedRoom) {
                                firebase.database().ref('rooms/' + savedRoom).once('value').then(roomSnap => {
                                    if (roomSnap.exists()) {
                                        joinOverlayRoomClone(savedRoom, roomSnap.val(), true);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    function setupChatEventListeners() {
        chatBackBtnClone.addEventListener('click', leaveOverlayRoomClone);
        overlaySendBtnClone.addEventListener('click', () => sendOverlayMessageClone());
        overlayChatInputClone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendOverlayMessageClone();
            }
        });

        // Typing
        overlayChatInputClone.addEventListener('input', () => {
            if(chatCurrentOverlayRoom) {
                firebase.database().ref(`room-typing/${chatCurrentOverlayRoom}/${chatCurrentUser.uid}`).set(chatCurrentProfile.displayName || "User");
                clearTimeout(chatTypingTimeout);
                chatTypingTimeout = setTimeout(() => firebase.database().ref(`room-typing/${chatCurrentOverlayRoom}/${chatCurrentUser.uid}`).remove(), 2000);
            }
        });

        cancelReplyBtnClone.addEventListener('click', cancelReplyClone);
        gifBtnClone.addEventListener('click', () => gifModalClone.style.display = 'flex');
        closeGifBtnClone.addEventListener('click', () => gifModalClone.style.display = 'none');
        gifSearchClone.addEventListener('input', debounceClone(searchGifsClone, 500));
    }

    function loadOverlayRoomsClone() {
        overlayRoomListClone.innerHTML = '<div style="text-align:center; padding:10px; color:#aaa;">Loading rooms...</div>';
        firebase.database().ref("rooms").limitToLast(50).once("value").then(snap => {
            overlayRoomListClone.innerHTML = '';
            if (!snap.exists()) {
                overlayRoomListClone.innerHTML = '<div style="text-align:center; padding:10px;">No rooms found.</div>';
                return;
            }
            const rooms = [];
            snap.forEach(child => {
                if (child.val().type !== 'dm') rooms.push({ key: child.key, val: child.val() });
            });
            rooms.sort((a, b) => (b.val.onlineUsers ? Object.keys(b.val.onlineUsers).length : 0) - (a.val.onlineUsers ? Object.keys(a.val.onlineUsers).length : 0) || a.key.localeCompare(b.key));
            rooms.forEach(room => {
                const div = document.createElement('div');
                div.className = 'overlay-room-item-clone';
                const count = room.val.onlineUsers ? Object.keys(room.val.onlineUsers).length : 0;
                let userNames = count > 0 ? Object.values(room.val.onlineUsers).map(u => u.name).join(", ") : "";
                if(userNames.length > 30) userNames = userNames.substring(0, 30) + "...";
                div.innerHTML = `
                    <div>
                        <div class="overlay-room-name-clone">#${room.key}</div>
                        <div style="font-size:0.7rem; color:#888;">${userNames}</div>
                    </div>
                    <span class="overlay-room-count-clone">👤 ${count}</span>`;
                div.onclick = () => joinOverlayRoomClone(room.key, room.val);
                overlayRoomListClone.appendChild(div);
            });
        });
    }

    function joinOverlayRoomClone(roomName, roomData) {
        if (roomData.type === 'private') {
            const pass = prompt(`Enter password for #${roomName}:`);
            if (pass !== roomData.password) { alert("Incorrect password."); return; }
        }
        chatCurrentOverlayRoom = roomName;
        chatHeaderTitleClone.innerText = `#${roomName}`;
        chatBackBtnClone.style.display = 'block';
        overlayRoomListClone.style.display = 'none';
        overlayChatViewClone.style.display = 'flex';
        updateChatBadge(false); // Clear badge on join
        overlayChatMessagesClone.innerHTML = '';
        
        const roomRef = firebase.database().ref(`room-messages/${roomName}`).limitToLast(50);
        chatOverlayMsgListener = roomRef.on('child_added', snapshot => {
            renderOverlayMessageClone(snapshot.val(), snapshot.key);
        });
        
        initPresenceClone(roomName);

        // Subscribe to typing
        firebase.database().ref(`room-typing/${roomName}`).on('value', snap => {
            const typing = snap.val() || {};
            const names = Object.keys(typing).filter(k => k !== chatCurrentUser.uid).map(k => typing[k]);
            if(names.length > 0) {
                typingIndicatorClone.style.display = 'block';
                typingIndicatorClone.innerText = names.join(", ") + (names.length === 1 ? " is typing..." : " are typing...");
            } else {
                typingIndicatorClone.style.display = 'none';
            }
        });
    }

    function initPresenceClone(roomName) {
        if (!chatCurrentUser || !chatCurrentProfile) return;
        const uid = chatCurrentUser.uid;
        const presenceRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${uid}`);
        
        // Set presence
        presenceRef.onDisconnect().remove();
        presenceRef.update({
            name: chatCurrentProfile.displayName || chatCurrentProfile.permanentUsername || "User",
            state: 'active',
            via: 'Sidebar'
        });

        // Listen for others - OPTIMIZED (Child events instead of value)
        const onlineUsersRef = firebase.database().ref(`rooms/${roomName}/onlineUsers`);
        const onlineUsersBar = document.getElementById('online-users-bar-clone');
        if(onlineUsersBar) onlineUsersBar.innerHTML = '';

        const handleUserUpdate = (snap) => {
            if(!onlineUsersBar) return;
            const u = snap.val();
            const uid = snap.key;
            let el = document.getElementById(`sb-presence-${uid}`);
            if (!el) {
                el = document.createElement('div');
                el.id = `sb-presence-${uid}`;
                el.className = 'online-user-clone';
                onlineUsersBar.appendChild(el);
            }
            const statusClass = u.state === 'active' ? 'active' : 'idle';
            const viaText = u.via === 'Sidebar' ? ' (Sidebar)' : (u.state === 'idle' ? ' (Idle)' : '');
            el.innerHTML = `<span class="status-dot-clone ${statusClass}"></span> <span>${u.name}${viaText}</span>`;
        };

        onlineUsersRef.on("child_added", handleUserUpdate);
        onlineUsersRef.on("child_changed", handleUserUpdate);
        onlineUsersRef.on("child_removed", snap => {
            const el = document.getElementById(`sb-presence-${snap.key}`);
            if (el) el.remove();
        });
    }

    // renderOnlineUsersClone removed (replaced by optimized listeners above)

    function leaveOverlayRoomClone() {
        if (chatCurrentOverlayRoom && chatOverlayMsgListener) {
            firebase.database().ref(`room-messages/${chatCurrentOverlayRoom}`).off('child_added', chatOverlayMsgListener);
            firebase.database().ref(`room-typing/${chatCurrentOverlayRoom}`).off();
            firebase.database().ref(`rooms/${chatCurrentOverlayRoom}/onlineUsers/${chatCurrentUser.uid}`).remove();
        }
        localStorage.removeItem('sidebar_chat_room');
        chatCurrentOverlayRoom = null;
        chatHeaderTitleClone.innerText = 'Rooms';
        chatBackBtnClone.style.display = 'none';
        overlayChatViewClone.style.display = 'none';
        overlayRoomListClone.style.display = 'flex';
        loadOverlayRoomsClone();
    }

    function createMessageDataClone(uid, profile, text, gifUrl = null) {
        return {
            senderUID: uid,
            displayName: profile.displayName || profile.permanentUsername || "User",
            permanentUsername: profile.permanentUsername || profile.displayName || "User",
            profilePicURL: profile.profilePicURL || null,
            badges: profile.badges || [],
            background: profile.equipped || "default",
            message: text,
            gifURL: gifUrl,
            replyTo: chatCurrentReply,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            dateSent: formatDate(new Date())
        };
    }

    function sendOverlayMessageClone() {
        if (!chatCurrentOverlayRoom || !chatCurrentUser) return;
        const messageText = overlayChatInputClone.value.trim();
        if (!messageText) return;
        const messageData = createMessageDataClone(chatCurrentUser.uid, chatCurrentProfile, messageText);
        firebase.database().ref(`room-messages/${chatCurrentOverlayRoom}`).push(messageData);
        overlayChatInputClone.value = '';
        overlayChatInputClone.focus();
        cancelReplyClone();
    }

    function initiateReplyClone(data) {
        chatCurrentReply = {
            sender: data.displayName,
            text: data.message || (data.gifURL ? "[GIF]" : "...")
        };
        replyTextClone.innerText = `Replying to ${chatCurrentReply.sender}: ${chatCurrentReply.text}`;
        replyBannerClone.style.display = 'flex';
        overlayChatInputClone.focus();
    }
    window.initiateReplyClone = initiateReplyClone;

    function initiateDMClone(targetUid, targetName) {
        if(targetUid === chatCurrentUser.uid) return;
        alert("Please go to the Dashboard to send a DM request.");
    }
    window.initiateDMClone = initiateDMClone;

    function renderOverlayMessageClone(data, key) {
        const isMe = data.senderUID === chatCurrentUser.uid;
        const isRecent = (Date.now() - (data.timestamp || 0)) < 60000;
        
        if (!isMe && isRecent && chatInitialized) {
            const sidebar = document.getElementById('fs-sidebar');
            if (!sidebar.classList.contains('open')) {
                // Sidebar closed: update toggle button badge
                const sbBadge = document.getElementById('fs-sidebar-badge');
                if (sbBadge) {
                    let count = parseInt(sbBadge.innerText) || 0;
                    sbBadge.innerText = count + 1;
                    sbBadge.style.display = 'flex';
                }

                // Show detailed notification
                showSidebarNotification(data, key);
            } else {
                // Sidebar open: check widget collapse
                const chatWidget = document.getElementById('widget-chat');
                if (chatWidget && chatWidget.classList.contains('collapsed')) {
                    updateChatBadge(true);
                }
            }
        }

        const msgDiv = document.createElement('div');
        msgDiv.id = 'sw-msg-' + key;

        let bgClass = ""; 
        let bgStyle = "";
        if (data.background && data.background !== "default") {
            bgClass = `bubble-${data.background}-clone`;
            if (shopConfig[data.background] && shopConfig[data.background].style) {
               bgStyle = `background: ${shopConfig[data.background].style} !important;`;
            }
        }

        msgDiv.className = `overlay-msg-clone ${isMe ? 'self' : 'other'} ${bgClass}`;
        if (bgStyle) msgDiv.style.cssText = bgStyle;

        const profilePicUrl = data.profilePicURL || "TWL O.png";
        const profileHtml = `<img src="${profilePicUrl}" class="overlay-pfp-clone">`;

        let badgesHtml = "";
        if (data.badges && Array.isArray(data.badges)) {
            data.badges.forEach(bid => {
                const info = badgeInfoMap[bid] || { displayName: bid, description: "" };
                badgesHtml += `<span class="overlay-badge-clone" title="${info.displayName}">${info.displayName}</span>`;
            });
        }

        const dateStr = data.dateSent || "Just now";
        const senderName = data.displayName || "User";
        
        let replyHtml = "";
        if(data.replyTo) {
            replyHtml = `<div class="reply-context-clone">Replying to ${data.replyTo.sender}: ${data.replyTo.text}</div>`;
        }

        const topHtml = `
            <div class="overlay-msg-top-clone">
                ${profileHtml}
                <div class="overlay-msg-meta-clone">
                    ${!isMe ? `<span class="overlay-msg-sender-clone" onclick="initiateDMClone('${data.senderUID}', '${senderName}')">${senderName}</span>` : ''}
                    ${badgesHtml}
                    <span class="overlay-date-clone">${dateStr}</span>
                    <span class="reply-btn-small-clone" onclick='initiateReplyClone(${JSON.stringify(data).replace(/'/g, "&#39;")})'>↩</span>
                </div>
            </div>`;

        const linkedText = (data.message || '').replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #80cbc4;">$1</a>');
        const gifHtml = data.gifURL ? `<br><img src="${data.gifURL}" class="gif-img-clone">` : "";
        const fileHtml = data.fileURL ? `<br><a href="${data.fileURL}" target="_blank" style="color:#45ffbc;">Download File</a>` : "";

        msgDiv.innerHTML = `${topHtml}<div class="overlay-msg-content-clone">${replyHtml}${linkedText}${gifHtml}${fileHtml}</div>`;
        overlayChatMessagesClone.appendChild(msgDiv);
        overlayChatMessagesClone.scrollTop = overlayChatMessagesClone.scrollHeight;
    }

    function listenForDMNotifications(myUid) {
        if (typeof firebase === 'undefined') return;
        const db = firebase.database();
        const _dmListeners = {};

        db.ref('users/' + myUid + '/private_chats').on('value', function(chatsSnap) {
            if (!chatsSnap.exists()) return;
            chatsSnap.forEach(function(child) {
                const chat = child.val();
                const roomId = chat.roomId;
                const chatName = chat.name || 'DM';
                if (!roomId || _dmListeners[roomId]) return;
                _dmListeners[roomId] = true;

                let isFirst = true;
                db.ref('room-messages/' + roomId).limitToLast(1).on('child_added', function(msgSnap) {
                    if (isFirst) { isFirst = false; return; }
                    const msg = msgSnap.val();
                    if (!msg || msg.senderUID === myUid) return;

                    // Don't notify if already in this room
                    const curRoom = localStorage.getItem('room_name');
                    const curPath = window.location.pathname.split('/').pop();
                    if (curPath === 'ch.html' && curRoom === roomId) return;

                    showSidebarNotification({
                        profilePicURL: msg.profilePicURL || 'TWL O.png',
                        displayName:   msg.displayName || 'Someone',
                        message:       msg.message || (msg.gifURL ? '📷 Image' : msg.fileURL ? '📎 File' : 'New message'),
                        dateSent:      msg.dateSent || '',
                        isDM: true, roomId, chatName
                    }, msgSnap.key);

                    // Mark unread
                    db.ref('users/' + myUid + '/private_chats').orderByChild('roomId')
                      .equalTo(roomId).once('value').then(function(s) {
                        s.forEach(function(c) {
                            db.ref('users/' + myUid + '/private_chats/' + c.key + '/unread').set(true);
                        });
                    });
                });
            });
        });
    }

    function openDMPreviewPanel(roomId, chatName) {
        const existing = document.getElementById('dm-preview-panel');
        if (existing) { existing.remove(); return; }
        const db = firebase.database();
        const myUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;

        if (!document.getElementById('dm-preview-style')) {
            const st = document.createElement('style');
            st.id = 'dm-preview-style';
            st.textContent = `
                #dm-preview-panel {
                    position:fixed; bottom:90px; right:24px; width:420px;
                    background:#1f1f1f; border:1px solid #3c3c3c; border-radius:18px;
                    z-index:2147483646; box-shadow:0 12px 40px rgba(0,0,0,0.7);
                    font-family:'Be Vietnam Pro',sans-serif; overflow:hidden;
                    animation:dmPrevIn 0.28s cubic-bezier(0.16,1,0.3,1) forwards;
                }
                @keyframes dmPrevIn {
                    from{opacity:0;transform:translateY(18px) scale(0.95);}
                    to{opacity:1;transform:translateY(0) scale(1);}
                }
                .dm-prev-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #333;}
                .dm-prev-title{font-weight:700;font-size:1.05rem;color:#fff;}
                .dm-prev-close{background:none;border:none;color:#aaa;font-size:1.4rem;cursor:pointer;line-height:1;padding:0;}
                .dm-prev-close:hover{color:#fff;}
                .dm-prev-msgs{padding:16px;display:flex;flex-direction:column;gap:12px;max-height:320px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#45ffbc transparent;}
                .dm-prev-msg{display:flex;gap:10px;align-items:flex-end;}
                .dm-prev-msg.me{flex-direction:row-reverse;}
                .dm-prev-msg img{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;}
                .dm-prev-bubble{max-width:72%;padding:10px 14px;border-radius:14px;font-size:0.9rem;line-height:1.45;background:#2e2e2e;color:#fff;word-break:break-word;}
                .dm-prev-msg.me .dm-prev-bubble{background:var(--accent,#45ffbc);color:#000;}
                .dm-prev-footer{padding:14px 16px;border-top:1px solid #333;}
                .dm-prev-open{display:block;width:100%;padding:14px;background:var(--accent,#45ffbc);color:#000;font-weight:800;font-size:1.05rem;border:none;border-radius:10px;cursor:pointer;text-align:center;transition:opacity 0.2s;}
                .dm-prev-open:hover{opacity:0.85;}
            `;
            document.head.appendChild(st);
        }

        const panel = document.createElement('div');
        panel.id = 'dm-preview-panel';
        panel.innerHTML = `
            <div class="dm-prev-header">
                <span class="dm-prev-title">💬 ${chatName}</span>
                <button class="dm-prev-close" onclick="document.getElementById('dm-preview-panel').remove()">&times;</button>
            </div>
            <div class="dm-prev-msgs" id="dm-prev-msgs">
                <div style="color:#aaa;font-size:0.85rem;text-align:center;padding:20px 0;">Loading messages...</div>
            </div>
            <div class="dm-prev-footer">
                <button class="dm-prev-open" onclick="localStorage.setItem('room_name','${roomId}');localStorage.removeItem('room_password');window.location.href='ch.html';">Open Full Chat ↗</button>
            </div>
        `;
        document.body.appendChild(panel);

        const messagesPath = roomId.startsWith('gc_')
            ? 'group_chat_messages/' + roomId
            : 'room-messages/' + roomId;

        db.ref(messagesPath).limitToLast(5).once('value').then(function(snap) {
            const msgsEl = document.getElementById('dm-prev-msgs');
            if (!msgsEl) return;
            msgsEl.innerHTML = '';
            if (!snap.exists()) {
                msgsEl.innerHTML = '<div style="color:#aaa;font-size:0.85rem;text-align:center;padding:20px 0;">No messages yet.</div>';
                return;
            }
            snap.forEach(function(child) {
                const msg = child.val();
                const isMe = myUid && msg.senderUID === myUid;
                const row = document.createElement('div');
                row.className = 'dm-prev-msg' + (isMe ? ' me' : '');
                const text = msg.message || (msg.gifURL ? '📷 Image' : msg.fileURL ? '📎 File' : '');
                row.innerHTML = `<img src="${msg.profilePicURL || 'TWL O.png'}" alt="pfp"><div class="dm-prev-bubble">${text}</div>`;
                msgsEl.appendChild(row);
            });
            msgsEl.scrollTop = msgsEl.scrollHeight;
        });
    }

    function showSidebarNotification(data, key) {
        let container = document.getElementById('fs-notif-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fs-notif-container';
            container.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483648;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
            document.body.appendChild(container);
        }

        const notif = document.createElement('div');
        notif.className = 'sidebar-notification';

        const pfp = data.profilePicURL || "TWL O.png";
        const name = data.displayName || "User";
        const dateParts = (data.dateSent || "").split(', ');
        const time = dateParts.length > 1 ? dateParts[1] : (data.dateSent || "Now");
        const source = data.isDM ? ' <span style="font-size:0.7rem;color:#45ffbc;font-weight:600;">· From DMs</span>' : '';

        let content = data.message;
        if (!content && data.gifURL) content = `<img src="${data.gifURL}" style="max-height:40px;border-radius:4px;">`;
        else if (!content && data.fileURL) content = '<span class="notif-media-tag">Sent a File</span>';

        const div = document.createElement('div');
        div.innerHTML = content;
        const text = div.textContent || div.innerText || "";
        if (text.length > 40) content = text.substring(0, 40) + '...';

        notif.innerHTML = `
            <img src="${pfp}" class="notif-pfp">
            <div class="notif-content">
                <div class="notif-header">
                    <span class="notif-sender">${name}${source}</span>
                    <span class="notif-time">${time}</span>
                </div>
                <div class="notif-body">${content}</div>
            </div>
        `;

        notif.onclick = () => {
            container.innerHTML = '';
            if (data.isDM && data.roomId) {
                openDMPreviewPanel(data.roomId, data.chatName || data.displayName || 'DM');
            } else {
                expandSidebar();
                updateChatBadge(false);
                setTimeout(() => {
                    const msgEl = document.getElementById('sw-msg-' + key);
                    if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 400);
            }
        };

        container.appendChild(notif);
        new Audio('Ping.mp3').play().catch(() => {});

        setTimeout(() => {
            notif.classList.add('hiding');
            notif.addEventListener('animationend', () => notif.remove());
        }, 5000);
    }

    // Expose globally so dashboard group chat listeners can trigger notifications
    window.showSidebarNotification = showSidebarNotification;
    window.openDMPreviewPanel      = openDMPreviewPanel;

    function debounceClone(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function searchGifsClone() {
        const q = gifSearchClone.value.trim();
        if(!q) return;
        gifResultsClone.innerHTML = 'Loading...';
        fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyBRfNHcJYTENDZ7Df_8Gh1C5PNjtZE2bU8&limit=10`)
            .then(r => r.json())
            .then(data => {
                gifResultsClone.innerHTML = '';
                data.results.forEach(g => {
                    const url = g.media_formats.tinygif.url;
                    const img = document.createElement('img');
                    img.src = url;
                    img.onclick = () => sendGifClone(url);
                    gifResultsClone.appendChild(img);
                });
            });
    }

    function sendGifClone(url) {
        if (!chatCurrentOverlayRoom || !chatCurrentUser) return;
        const msgData = createMessageDataClone(chatCurrentUser.uid, chatCurrentProfile, "", url);
        firebase.database().ref(`room-messages/${chatCurrentOverlayRoom}`).push(msgData);
        gifModalClone.style.display = 'none';
        gifSearchClone.value = '';
        gifResultsClone.innerHTML = '';
    }

    function cancelReplyClone() {
        chatCurrentReply = null;
        replyBannerClone.style.display = 'none';
    }

    // --- WIDGET-SPECIFIC LOGIC ---
    function loadWidgetData() {
        // System Info
        const sysInfoContent = document.getElementById('fs-sysinfo-content');
        if (sysInfoContent) {
            const ua = navigator.userAgent;
            let browser = "Unknown";
            if(ua.indexOf("Chrome") > -1) browser = "Chrome";
            else if(ua.indexOf("Safari") > -1) browser = "Safari";
            else if(ua.indexOf("Firefox") > -1) browser = "Firefox";
            else if(ua.indexOf("Edg") > -1) browser = "Edge";

            let os = "Unknown";
            if (ua.indexOf("Win") != -1) os = "Windows";
            else if (ua.indexOf("Mac") != -1) os = "MacOS";
            else if (ua.indexOf("Linux") != -1) os = "Linux";
            else if (ua.indexOf("Android") != -1) os = "Android";
            else if (ua.indexOf("like Mac") != -1) os = "iOS";

            sysInfoContent.innerHTML = `
                <b>Browser:</b> ${browser}<br>
                <b>OS:</b> ${os}<br>
                <b>Screen:</b> ${window.screen.width} x ${window.screen.height}<br>
                <b>Window:</b> ${window.innerWidth} x ${window.innerHeight}
            `;
            
            window.addEventListener('resize', () => {
                sysInfoContent.innerHTML = `
                    <b>Browser:</b> ${browser}<br>
                    <b>OS:</b> ${os}<br>
                    <b>Screen:</b> ${window.screen.width} x ${window.screen.height}<br>
                    <b>Window:</b> ${window.innerWidth} x ${window.innerHeight}
                `;
            });
        }

        // Calculator
        const calcDisplay = sidebar.querySelector('.calc-display');
        let calcExpression = '';
        sidebar.querySelectorAll('.calc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.innerText;
                if (val === 'C') { calcExpression = ''; }
                else if (val === '=') { try { calcExpression = new Function('return ' + calcExpression)().toString(); } catch { calcExpression = 'Error'; } }
                else { if (calcExpression === 'Error') calcExpression = ''; calcExpression += val; }
                calcDisplay.innerText = calcExpression || '0';
            });
        });

        // To-Do List
        const todoInput = document.getElementById('fs-todo-input');
        const todoList = document.getElementById('fs-todo-list');
        let todos = getJSON('fs_todos', []);
        const renderTodos = () => {
            todoList.innerHTML = '';
            todos.forEach((todo, index) => {
                const li = document.createElement('li');
                li.className = `todo-item ${todo.done ? 'done' : ''}`;
                li.innerHTML = `<div style="display:flex; align-items:center; overflow:hidden;"><input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} style="margin-right:8px;"><span title="${todo.text}">${todo.text}</span></div><button style="background:rgba(255,255,255,0.1);color:#aaa;border:none;border-radius:4px;cursor:pointer;padding:2px 6px;font-size:0.7rem;">✕</button>`;
                li.querySelector('input').onchange = () => { todos[index].done = !todos[index].done; setJSON('fs_todos', todos); renderTodos(); };
                li.querySelector('button').onclick = () => { todos.splice(index, 1); setJSON('fs_todos', todos); renderTodos(); };
                todoList.appendChild(li);
            });
        };
        const addTodo = () => { const text = todoInput.value.trim(); if (text) { todos.push({ text, done: false }); setJSON('fs_todos', todos); renderTodos(); todoInput.value = ''; } };
        document.getElementById('fs-todo-add').addEventListener('click', addTodo);
        todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
        renderTodos();
        
        // Multi-page Notes
        setupNotes();

        // Stopwatch
        const swDisplay = document.getElementById('fs-stopwatch-display');
        let swInterval, swTime = 0;
        const formatTime = ms => new Date(ms).toISOString().slice(11, -2);
        document.getElementById('fs-sw-start').onclick = () => { if (!swInterval) { const s = Date.now() - swTime; swInterval = setInterval(() => { swTime = Date.now() - s; swDisplay.innerText = formatTime(swTime); }, 100); } };
        document.getElementById('fs-sw-stop').onclick = () => { clearInterval(swInterval); swInterval = null; };
        document.getElementById('fs-sw-reset').onclick = () => { clearInterval(swInterval); swInterval = null; swTime = 0; swDisplay.innerText = "00:00:00.0"; };

        // Notes
        // Logic moved to setupNotes()

        // Weather
        fetchAndRenderWeather();

        // Quote
        setupQuote();

        // Unit Converter
        setupConverter();

        // Theme Settings
        setupThemeSettings();

        // New Widgets
        setupPomodoro();
        setupBreathing();
        setupTicTacToe();
        setupDictionary();

        // Game
        document.getElementById('fs-play-btn').onclick = () => {
            document.getElementById('fs-game-frame').src = document.getElementById('fs-game-select').value;
        };
    }

    function setupNotes() {
        const notesArea = document.getElementById('fs-notes');
        const noteTabs = document.querySelectorAll('.note-tab-btn');
        let notesData = getJSON('fs_notes_v2', { "1": "", "2": "", "3": "" });
        let activePage = "1";

        const saveCurrentNote = () => {
            notesData[activePage] = notesArea.value;
            setJSON('fs_notes_v2', notesData);
        };

        noteTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                saveCurrentNote();
                noteTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activePage = tab.dataset.page;
                notesArea.value = notesData[activePage] || '';
                notesArea.placeholder = `Type notes for Page ${activePage}...`;
            });
        });

        notesArea.value = notesData[activePage];
        notesArea.addEventListener('input', saveCurrentNote);
    }

    // --- START ---
    initializeSidebar();

// ═══════════════════════════════════════════════════════
// ADMIN ABUSE SYSTEM — sidebar.js patch
// Paste this entire block at the END of sidebar.js,
// just before the closing }); of DOMContentLoaded
// ═══════════════════════════════════════════════════════

// ── Styles ──────────────────────────────────────────────
(function() {
const abuseStyle = document.createElement('style');
abuseStyle.textContent = `
/* ── Admin Abuse Banner ── */
#aa-banner {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: 2147483640;
    display: none;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
}
#aa-banner-inner {
    pointer-events: auto;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    border-radius: 20px 20px 0 0;
    padding: 18px 28px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    overflow: hidden;
}

/* STYLE: gold */
.aa-style-gold #aa-banner-inner {
    background: linear-gradient(135deg, #1a1200, #3d2b00, #1a1200);
    border: 2px solid #ffd700;
    border-bottom: none;
    box-shadow: 0 -8px 40px rgba(255,215,0,0.5), inset 0 0 60px rgba(255,215,0,0.05);
}
.aa-style-gold .aa-title { color: #ffd700; text-shadow: 0 0 20px #ffd700, 0 0 40px #ffa500; }
.aa-style-gold .aa-join-btn { background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000; }

/* STYLE: plasma */
.aa-style-plasma #aa-banner-inner {
    background: linear-gradient(135deg, #0d001a, #1a0030, #0d001a);
    border: 2px solid #c800ff;
    border-bottom: none;
    box-shadow: 0 -8px 40px rgba(200,0,255,0.5), inset 0 0 60px rgba(200,0,255,0.07);
    animation: aaPlasmaPulse 2s ease-in-out infinite;
}
@keyframes aaPlasmaPulse { 0%,100%{box-shadow:0 -8px 40px rgba(200,0,255,0.5)} 50%{box-shadow:0 -8px 60px rgba(200,0,255,0.9),0 0 80px rgba(0,200,255,0.4)} }
.aa-style-plasma .aa-title { color: #e060ff; text-shadow: 0 0 20px #c800ff, 0 0 40px #7700ff; animation: aaRainbow 3s linear infinite; }
.aa-style-plasma .aa-join-btn { background: linear-gradient(135deg, #c800ff, #0080ff); color: #fff; }

/* STYLE: fire */
.aa-style-fire #aa-banner-inner {
    background: linear-gradient(135deg, #1a0000, #3d0000, #1a0500);
    border: 2px solid #ff4400;
    border-bottom: none;
    box-shadow: 0 -8px 40px rgba(255,68,0,0.6);
    animation: aaFireFlicker 0.15s steps(2) infinite;
}
@keyframes aaFireFlicker { 0%{box-shadow:0 -8px 40px rgba(255,68,0,0.6)} 100%{box-shadow:0 -8px 50px rgba(255,150,0,0.8)} }
.aa-style-fire .aa-title { color: #ff6600; text-shadow: 0 0 10px #ff4400, 0 0 30px #ff8800; }
.aa-style-fire .aa-join-btn { background: linear-gradient(135deg, #ff4400, #ff9900); color: #fff; }

/* STYLE: ice */
.aa-style-ice #aa-banner-inner {
    background: linear-gradient(135deg, #001020, #002040, #001020);
    border: 2px solid #00cfff;
    border-bottom: none;
    box-shadow: 0 -8px 40px rgba(0,207,255,0.4);
}
.aa-style-ice .aa-title { color: #a0f0ff; text-shadow: 0 0 20px #00cfff; }
.aa-style-ice .aa-join-btn { background: linear-gradient(135deg, #00cfff, #0080ff); color: #000; }

/* STYLE: rainbow */
.aa-style-rainbow #aa-banner-inner {
    background: #111;
    border: 3px solid transparent;
    border-bottom: none;
    border-image: linear-gradient(90deg,#ff0000,#ff7f00,#ffff00,#00ff00,#0000ff,#8b00ff,#ff0000) 1;
    animation: aaRainbowBorder 2s linear infinite;
}
.aa-style-rainbow .aa-title { animation: aaRainbow 2s linear infinite; }
@keyframes aaRainbow {
    0%{color:#ff0000} 16%{color:#ff7f00} 33%{color:#ffff00}
    50%{color:#00ff00} 66%{color:#0000ff} 83%{color:#8b00ff} 100%{color:#ff0000}
}
.aa-style-rainbow .aa-join-btn { background: linear-gradient(90deg,#ff0000,#ff7f00,#ffff00,#00ff00,#0000ff,#8b00ff); color: #fff; }

.aa-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.aa-title { font-size: 1.3rem; font-weight: 900; letter-spacing: 1px; flex: 1; min-width: 200px; }
.aa-countdown { font-size: 1rem; font-weight: 700; color: #fff; background: rgba(0,0,0,0.4); padding: 4px 14px; border-radius: 20px; white-space: nowrap; }
.aa-join-btn {
    border: none; padding: 10px 24px; border-radius: 30px;
    font-weight: 900; font-size: 1rem; cursor: pointer;
    letter-spacing: 1px; transition: transform 0.15s, filter 0.15s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.aa-join-btn:hover { transform: scale(1.06); filter: brightness(1.15); }
.aa-play-btn {
    border: none; padding: 10px 28px; border-radius: 30px;
    font-weight: 900; font-size: 1.05rem; cursor: pointer;
    letter-spacing: 1px; transition: transform 0.15s, filter 0.15s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    background: linear-gradient(135deg, #43b581, #00ff88);
    color: #000;
    animation: aaPlayBtnPulse 1.2s ease-in-out infinite;
}
.aa-play-btn:hover { transform: scale(1.08); filter: brightness(1.2); }
@keyframes aaPlayBtnPulse {
    0%,100% { box-shadow: 0 4px 20px rgba(67,181,129,0.4); }
    50%      { box-shadow: 0 4px 32px rgba(67,181,129,0.9), 0 0 60px rgba(0,255,136,0.3); }
}
.aa-host-waiting {
    font-size: 0.88rem; font-weight: 700;
    color: #ffa500;
    animation: aaHostPulse 1.5s ease-in-out infinite;
    letter-spacing: 0.5px;
}
@keyframes aaHostPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.aa-participants { font-size: 0.78rem; color: rgba(255,255,255,0.6); }
.aa-game-label { font-size: 0.82rem; color: rgba(255,255,255,0.55); }

/* ── Live Ticker Overlay ── */
#aa-ticker-wrap {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 2147483641;
    pointer-events: none;
    display: none;
}

/* Ticker bar */
#aa-ticker-bar {
    position: absolute; top: 0; left: 0; right: 0;
    background: rgba(0,0,0,0.92);
    border-bottom: 3px solid #ffd700;
    padding: 10px 20px;
    display: flex; align-items: center; gap: 14px;
    backdrop-filter: blur(12px);
}
#aa-ticker-title {
    font-weight: 900; font-size: 1rem; white-space: nowrap;
    background: linear-gradient(90deg,#ffd700,#ff8c00);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    letter-spacing: 1px;
}
#aa-ticker-live {
    background: #f04747; color: #fff; font-size: 0.7rem; font-weight: 900;
    padding: 2px 8px; border-radius: 20px; animation: aaLivePulse 1s ease-in-out infinite;
    white-space: nowrap;
}
@keyframes aaLivePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
#aa-ticker-scores {
    flex: 1; display: flex; gap: 12px; overflow: hidden; flex-wrap: nowrap; align-items: center;
}
.aa-score-chip {
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.1); border-radius: 20px;
    padding: 4px 12px 4px 6px; white-space: nowrap; flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.15);
    transition: background 0.3s;
}
.aa-chip-meta {
    font-size: 0.72rem;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 0.02em;
}
.aa-score-chip.leader {
    background: rgba(255,215,0,0.25);
    border-color: #ffd700;
    animation: aaLeaderGlow 1.5s ease-in-out infinite;
}
@keyframes aaLeaderGlow { 0%,100%{box-shadow:0 0 8px rgba(255,215,0,0.4)} 50%{box-shadow:0 0 20px rgba(255,215,0,0.9)} }
.aa-score-chip img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
.aa-chip-name { font-size: 0.8rem; font-weight: 700; color: #fff; }
.aa-chip-pts { font-size: 0.85rem; font-weight: 900; color: #ffd700; }
.aa-chip-rank { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-right: 2px; }

#aa-ticker-timer {
    font-size: 1rem; font-weight: 900; color: #45ffbc;
    white-space: nowrap; font-variant-numeric: tabular-nums;
}

/* ── Announcement Blast ── */
#aa-announce {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0);
    text-align: center;
    pointer-events: none;
    z-index: 10;
}
#aa-announce.firing {
    animation: aaAnnouncePop 3.5s cubic-bezier(0.22,1,0.36,1) forwards;
}
@keyframes aaAnnouncePop {
    0%   { transform: translate(-50%,-50%) scale(0) rotate(-15deg); opacity:0; filter: blur(20px); }
    8%   { transform: translate(-50%,-50%) scale(1.5) rotate(5deg);  opacity:1; filter: blur(0); }
    14%  { transform: translate(-50%,-50%) scale(0.9) rotate(-3deg); opacity:1; }
    20%  { transform: translate(-50%,-50%) scale(1.08) rotate(1deg); opacity:1; }
    25%  { transform: translate(-50%,-50%) scale(1) rotate(0deg);    opacity:1; }
    75%  { transform: translate(-50%,-50%) scale(1) rotate(0deg);    opacity:1; }
    88%  { transform: translate(-50%,-50%) scale(1.1) rotate(-2deg); opacity:0.8; filter: blur(0); }
    100% { transform: translate(-50%,-50%) scale(0.5) rotate(10deg); opacity:0; filter: blur(15px); }
}
#aa-announce-text {
    font-size: 2.4rem; font-weight: 900;
    color: #fff;
    text-shadow: 0 0 30px #ffd700, 0 0 60px #ff8c00, 3px 3px 0 rgba(0,0,0,0.5);
    padding: 20px 40px;
    background: rgba(0,0,0,0.75);
    border: 3px solid #ffd700;
    border-radius: 20px;
    backdrop-filter: blur(10px);
    animation: aaRainbow 1s linear infinite;
    max-width: 80vw;
    word-break: break-word;
}

.aa-special-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 2147483648; animation: broadcastFadeIn 0.3s ease;
}
.aa-special-card {
    position: relative; width: min(95vw, 760px); max-width: 95vw; padding: 28px; border-radius: 28px;
    overflow: hidden; background: rgba(10,10,18,0.96);
    box-shadow: 0 0 80px rgba(0,0,0,0.75), inset 0 0 16px rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12); color: #fff; transform: translateZ(0); pointer-events: auto;
}
.aa-special-card.aa-safe-card { background: linear-gradient(180deg, #3f3b1f, #141217); border-color: #ffd73a; min-height: min(88vw, 640px); }
.aa-special-card.aa-pig-card { background: linear-gradient(180deg, #5f3e00, #1b0f00); border-color: #ffd166; }
.aa-special-title { margin: 0 0 14px; font-size: 2.1rem; letter-spacing: 1px; text-transform: uppercase;
    color: #ffd700; text-shadow: 0 0 25px rgba(255,206,0,0.5);
}
.aa-special-subtitle { margin: 0; color: #f0f0f0; opacity: 0.9; }
.aa-special-code { margin: 18px 0 8px; font-size: 1.2rem; letter-spacing: 0.05em; }
.aa-special-code strong { color: #fff; display: block; margin-top: 4px; font-size: 1.6rem; }
.aa-special-value { color: #ffd700; margin-bottom: 12px; font-weight: 900; }
.aa-special-message { color: #d6d6d6; line-height: 1.55; }
.aa-safe-shell {
    position: absolute; left: 50%; top: 52%; width: clamp(280px, 72vw, 560px); height: clamp(280px, 72vw, 560px);
    transform: translate(-50%, -50%);
    border-radius: 50%; overflow: hidden;
    background: radial-gradient(circle at 30% 25%, #f4f7fb 0%, #b7bcc4 20%, #7b8390 55%, #323940 100%);
    border: 4px solid rgba(255,255,255,0.18); box-shadow: inset 0 0 36px rgba(255,255,255,0.15), 0 26px 70px rgba(0,0,0,0.4);
    perspective: 1200px;
}
.aa-safe-shell::before {
    content: '';
    position: absolute; inset: 12px;
    border-radius: 50%; border: 2px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 0 20px rgba(255,255,255,0.12);
}
.aa-safe-door {
    position: absolute; left: 50%; top: 50%; width: 82%; height: 82%;
    border-radius: 50%; background: radial-gradient(circle at 35% 35%, #eaeff2 0%, #bcc6d0 28%, #8f98a2 58%, #3c454d 100%);
    border: 10px solid rgba(255,255,255,0.22);
    box-shadow: inset 0 0 22px rgba(255,255,255,0.12), inset 0 -10px 20px rgba(0,0,0,0.18), 0 20px 48px rgba(0,0,0,0.35);
    transform: translate(-50%, -50%) rotateY(0deg);
    transform-origin: left center;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    animation: aaSafeDoorOpen 2.4s cubic-bezier(0.16,1,0.3,1) forwards 0.6s;
    z-index: 1;
    max-width: 500px;
    max-height: 500px;
    min-width: 220px;
    min-height: 220px;
}
.aa-safe-door::before {
    content: '';
    position: absolute; inset: 16px;
    border-radius: 50%; background: rgba(255,255,255,0.06);
    box-shadow: inset 0 0 20px rgba(255,255,255,0.08);
}
.aa-safe-door::after {
    content: '';
    position: absolute; top: 18px; right: 18px; width: 16px; height: 34px;
    background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.2));
    border-radius: 10px; box-shadow: 0 0 6px rgba(255,255,255,0.25);
    transform: translateZ(5px);
}
.aa-safe-dial {
    position: absolute; left: 50%; top: 50%; width: 110px; height: 110px;
    transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle at 50% 50%, #f9fbfd 0%, #cdd4dc 40%, #a3abb4 65%, #5b6470 100%), repeating-conic-gradient(from 0deg, rgba(255,255,255,0.18) 0deg 6deg, transparent 6deg 12deg);
    border: 5px solid rgba(34,34,34,0.16);
    box-shadow: inset 0 6px 18px rgba(255,255,255,0.55), 0 0 18px rgba(0,0,0,0.2);
    animation: aaSafeDialSpin 1.4s cubic-bezier(0.22,0.9,0.36,1) forwards;
}
.aa-safe-dial::before {
    content: '';
    position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle at 35% 35%, #fff 0%, #d8dde3 45%, #8a9099 100%);
    box-shadow: inset 0 0 8px rgba(255,255,255,0.85);
}
.aa-safe-dial::after {
    content: '';
    position: absolute; left: 50%; top: 50%; width: 6px; height: 48px;
    transform: translate(-50%, -90%);
    border-radius: 4px; background: rgba(35,35,35,0.92);
    box-shadow: 0 0 6px rgba(0,0,0,0.35);
}
.aa-safe-door::before {
    content: '';
    position: absolute; inset: 12px;
    border-radius: 50%; background: rgba(255,255,255,0.08);
}
.aa-safe-fog {
    position: absolute; left: 50%; top: 46%; width: 260px; height: 220px;
    transform: translateX(-50%); pointer-events: none; animation: aaFogRise 1.2s ease forwards 0.8s; z-index: 0;
}
.aa-safe-code {
    position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%) scale(0.92); opacity: 0;
    color: #fff; font-size: 1rem; letter-spacing: 0.08em; text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.16); backdrop-filter: blur(10px);
    background: rgba(0,0,0,0.35); padding: 10px 18px; border-radius: 999px;
    transition: opacity 0.35s ease, transform 0.35s ease;
    pointer-events: none;
}
.aa-safe-code.aa-code-visible { opacity: 1; transform: translateX(-50%) scale(1); }
.aa-safe-fog::before,
.aa-safe-fog::after {
    content: '';
    position: absolute; left: 50%; width: 160px; height: 120px;
    background: rgba(255,255,255,0.24); border-radius: 50%; filter: blur(16px);
    transform: translateX(-50%);
}
.aa-safe-fog::before { top: 12px; }
.aa-safe-fog::after { top: 70px; width: 220px; opacity: 0.18; }
.aa-pig-graphic {
    display: inline-flex; align-items: center; justify-content: center;
    width: 112px; height: 112px; margin: 0 auto 18px;
    border-radius: 50%; background: radial-gradient(circle at 30% 25%, #fff5b7 0%, #ffd066 35%, #d48c21 70%, #a36508 100%);
    box-shadow: inset 0 0 30px rgba(255,255,255,0.35), 0 18px 40px rgba(0,0,0,0.35);
    font-size: 3rem; color: #fff; text-shadow: 0 4px 18px rgba(0,0,0,0.25);
    animation: aaPigBounce 1.4s ease-in-out infinite;
}
.aa-diamond {
    position: absolute; width: 18px; height: 18px;
    background: linear-gradient(135deg, #f6f7ff 0%, #a7ecff 30%, #5fd0ff 60%, #3b94ff 100%);
    border: 1px solid rgba(255,255,255,0.8); border-radius: 4px;
    transform: rotate(45deg);
    box-shadow: 0 0 18px rgba(126,219,255,0.85), inset 0 0 4px rgba(255,255,255,0.7);
}
.aa-diamond::after {
    content: '';
    position: absolute; inset: 4px;
    background: rgba(255,255,255,0.45);
    border-radius: 2px; filter: blur(0.2px);
}
.aa-wing-code {
    position: absolute; display: flex; align-items: center; justify-content: center;
    gap: 8px; min-width: 120px; padding: 10px 16px; border-radius: 999px;
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22);
    color: #fff; font-size: 0.95rem; text-transform: uppercase; backdrop-filter: blur(6px);
    animation: aaWingFlight 8s linear infinite; box-shadow: 0 12px 30px rgba(0,0,0,0.35);
}
.aa-wing-code .aa-wing { display: inline-block; font-size: 1.2rem; animation: aaWingFlap 1s ease-in-out infinite alternate; }

/* Shared popup animations */
@keyframes broadcastFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes broadcastFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes aaSafeDoorOpen { 0% { transform: translate(-50%, -50%) rotateY(0deg); } 40% { transform: translate(-50%, -50%) rotateY(-18deg); } 100% { transform: translate(-50%, -50%) rotateY(-115deg); } }
@keyframes aaSafeDialSpin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 30% { transform: translate(-50%, -50%) rotate(1440deg); } 60% { transform: translate(-50%, -50%) rotate(1020deg); } 100% { transform: translate(-50%, -50%) rotate(1260deg); } }
@keyframes aaFogRise { 0% { opacity: 0; transform: translate(-50%, 10px) scale(0.8); } 100% { opacity: 1; transform: translate(-50%, -30px) scale(1.05); } }
@keyframes aaPigBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
@keyframes aaDiamondFloat { 0% { transform: translateY(0) scale(0.8) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(-36px) scale(1.1) rotate(20deg); } 100% { transform: translateY(-80px) scale(0.9) rotate(40deg); opacity: 0; } }
@keyframes aaWingFlight { 0% { transform: translateX(0) translateY(0); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateX(280px) translateY(-20px); } 100% { transform: translateX(560px) translateY(0); opacity: 0; } }
@keyframes aaWingFlap { from { transform: rotate(0deg) translateY(0); } to { transform: rotate(8deg) translateY(-2px); } }

/* ── Confetti bursts ── */
.aa-confetti-piece {
    position: fixed; pointer-events: none; z-index: 2147483642;
    width: 10px; height: 10px; border-radius: 2px;
    animation: aaConfettiFall linear forwards;
}
@keyframes aaConfettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
`;
document.head.appendChild(abuseStyle);

// ── Inject HTML ──────────────────────────────────────────
const abuseHTML = document.createElement('div');
abuseHTML.innerHTML = `
<div id="aa-banner">
  <div id="aa-banner-inner">
    <div class="aa-row">
      <div class="aa-title" id="aa-title">⚡ ADMIN ABUSE</div>
      <div class="aa-countdown" id="aa-countdown">Loading...</div>
      <button class="aa-join-btn" id="aa-join-btn">JOIN</button>
      <button class="aa-play-btn" id="aa-play-btn" style="display:none;">▶ PLAY NOW</button>
    </div>
    <div class="aa-row">
      <div class="aa-game-label" id="aa-game-label"></div>
      <div class="aa-participants" id="aa-participants"></div>
      <div class="aa-host-waiting" id="aa-host-waiting" style="display:none;">⏳ Waiting for Host to start...</div>
    </div>
  </div>
</div>

<div id="aa-ticker-wrap">
  <div id="aa-ticker-bar">
    <span id="aa-ticker-title">⚡ ADMIN ABUSE</span>
    <span id="aa-ticker-live">● LIVE</span>
    <div id="aa-ticker-scores"></div>
    <div id="aa-ticker-timer">⏱ 00:00</div>
  </div>
  <div id="aa-announce">
    <div id="aa-announce-text"></div>
  </div>
</div>
`;
document.body.appendChild(abuseHTML);

// ── State ────────────────────────────────────────────────
let _aaEvent       = null;
let _aaMyUid       = null;
let _aaMyProfile   = null;
let _aaJoined      = false;
let _aaScores      = {};
let _aaCountdownId = null;
let _aaTickerTimerId = null;
let _aaLastAnnounce = localStorage.getItem('aa_last_announce') || null;
let _aaPopupKeys    = new Set(getJSON('aa_seen_popups', []));

const _aaRef = () => firebase && firebase.apps && firebase.apps.length ? firebase.database().ref('admin_abuse/current') : null;

// ── Auth hook ────────────────────────────────────────────
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged(user => {
        if (!user) return;
        _aaMyUid = user.uid;
        firebase.database().ref('users/' + user.uid).once('value').then(s => {
            _aaMyProfile = s.val() || {};
            _aaStartListening();
        });
    });
}

function _aaStartListening() {
    const r = _aaRef();
    if (!r) return;

    // Listen to event meta
    r.on('value', snap => {
        _aaEvent = snap.val();
        _aaRenderBanner();
        _aaRenderTicker();
    });

    // Listen to scores
    r.child('scores').on('value', snap => {
        _aaScores = snap.val() || {};
        _aaRenderTickerScores();
    });

    // Listen to joined count
    r.child('joined').on('value', snap => {
        const joined = snap.val() || {};
        _aaJoined = !!joined[_aaMyUid];
        _aaUpdateJoinBtn();
        const count = Object.keys(joined).length;
        const el = document.getElementById('aa-participants');
        if (el) el.textContent = count > 0 ? `👥 ${count} joined` : '';
    });

    // Listen to announcements
    r.child('announcement').on('value', snap => {
        const ann = snap.val();
        if (!ann || !ann.text) return;
        const announceKey = String(ann.timestamp || ann.text);
        if (_aaLastAnnounce === announceKey) return;
        _aaLastAnnounce = announceKey;
        localStorage.setItem('aa_last_announce', announceKey);
        _aaFireAnnouncement(ann.text);
    });

    // Listen to individual award notifications (show on ticker + announcement)
    r.child('lastAward').on('value', snap => {
        const award = snap.val();
        if (!award || !award.timestamp) return;
        const awardKey = 'award_' + award.timestamp;
        if (_aaLastAnnounce === awardKey) return;
        _aaLastAnnounce = awardKey;
        localStorage.setItem('aa_last_announce', awardKey);
        // Add to ticker scores display as a special chip
        _aaShowAwardChip(award);
        // Also fire the announcement text
        _aaFireAnnouncement(award.text || ('💎 ' + award.name + ' was awarded ' + award.pts + ' points!'));
    });

    // Listen to special popup events
    r.child('popups').limitToLast(20).on('child_added', snap => {
        const key = snap.key;
        if (_aaPopupKeys.has(key)) return;
        _aaPopupKeys.add(key);
        setJSON('aa_seen_popups', Array.from(_aaPopupKeys).slice(-100));
        const popup = snap.val();
        if (!popup || !popup.type) return;
        _aaHandleAASpecialPopup(popup);
    });
}

function _aaRenderBanner() {
    const banner = document.getElementById('aa-banner');
    const tickerWrap = document.getElementById('aa-ticker-wrap');
    if (!_aaEvent || !banner) {
        if (banner) banner.style.display = 'none';
        if (tickerWrap) tickerWrap.style.display = 'none';
        return;
    }

    // Apply style class
    const styleClass = 'aa-style-' + (_aaEvent.style || 'gold');
    banner.className = styleClass;
    banner.style.display = 'flex';

    const titleEl = document.getElementById('aa-title');
    const gameEl  = document.getElementById('aa-game-label');
    if (titleEl) titleEl.textContent = (_aaEvent.title || '⚡ ADMIN ABUSE');
    if (gameEl)  gameEl.textContent  = _aaEvent.game ? '🎮 Game: ' + _aaEvent.game : '';

    // Apply style to ticker too
    const tickerBar = document.getElementById('aa-ticker-bar');
    if (tickerBar) {
        tickerBar.className = '';
        tickerBar.classList.add('aa-tickerbar-' + (_aaEvent.style || 'gold'));
    }
    const tickerTitle = document.getElementById('aa-ticker-title');
    if (tickerTitle) tickerTitle.textContent = '⚡ ' + (_aaEvent.title || 'ADMIN ABUSE');

    if (_aaEvent.status === 'live') {
        // Show ticker AND keep banner visible with PLAY NOW button
        if (tickerWrap) tickerWrap.style.display = 'block';
        banner.style.display = 'flex';
        _aaStartTickerTimer();
    } else {
        // scheduled — show banner, hide ticker
        if (tickerWrap) tickerWrap.style.display = 'none';
        _aaStartCountdown();
    }

    _aaUpdateJoinBtn();
    _aaUpdateHostWaiting();
}

function _aaUpdateHostWaiting() {
    const hw = document.getElementById('aa-host-waiting');
    if (!hw || !_aaEvent) return;
    // Show "waiting for host" when time has passed but event not yet started
    const target = _aaEvent.startsAt || 0;
    const pastTime = target > 0 && Date.now() > target;
    const isWaiting = _aaEvent.status === 'scheduled' && pastTime;
    hw.style.display = isWaiting ? 'block' : 'none';
}

function _aaStartCountdown() {
    clearInterval(_aaCountdownId);
    const showMs = _aaEvent && _aaEvent.showMilliseconds === true;
    const interval = showMs ? 50 : 1000;
    _aaCountdownId = setInterval(() => {
        const el = document.getElementById('aa-countdown');
        if (!el || !_aaEvent) return;
        const target = _aaEvent.startsAt || _aaEvent.scheduledAt;
        if (!target) { el.textContent = 'Starting soon'; return; }
        const diff = target - Date.now();
        if (diff <= 0) {
            el.textContent = '';
            _aaUpdateHostWaiting();
            clearInterval(_aaCountdownId);
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const ms = diff % 1000;
        const msPart = showMs ? `.${Math.floor(ms / 10).toString().padStart(2, '0')}` : '';
        el.textContent = h > 0
            ? `⏰ ${h}h ${m}m ${s}${msPart}s`
            : `⏰ ${m}m ${s}${msPart}s`;
    }, interval);
}

function _aaStartTickerTimer() {
    clearInterval(_aaTickerTimerId);
    const showMs = _aaEvent && _aaEvent.showMilliseconds === true;
    const interval = showMs ? 50 : 1000;
    _aaTickerTimerId = setInterval(() => {
        const el = document.getElementById('aa-ticker-timer');
        if (!el || !_aaEvent || !_aaEvent.liveStartedAt) return;
        const elapsed = Date.now() - _aaEvent.liveStartedAt;
        const dur     = (_aaEvent.duration || 300) * 1000;
        const left    = Math.max(0, dur - elapsed);
        const m = Math.floor(left / 60000).toString().padStart(2, '0');
        const s = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
        const ms = left % 1000;
        const msPart = showMs ? `.${Math.floor(ms / 10).toString().padStart(2, '0')}` : '';
        el.textContent = `⏱ ${m}:${s}${msPart}`;
        if (left === 0) clearInterval(_aaTickerTimerId);
    }, interval);
}

function _aaRenderTicker() {
    _aaRenderTickerScores();
}

function _aaRenderTickerScores() {
    const container = document.getElementById('aa-ticker-scores');
    if (!container) return;
    container.innerHTML = '';

    const sorted = Object.entries(_aaScores)
        .sort((a, b) => (b[1].livePoints || b[1].score || 0) - (a[1].livePoints || a[1].score || 0));

    if (sorted.length === 0) {
        container.innerHTML = '<span style="color:#aaa;font-size:0.8rem;">No scores yet...</span>';
        return;
    }

    sorted.forEach(([uid, data], idx) => {
        const livePoints = data.livePoints != null ? data.livePoints : data.score || 0;
        const highScore = data.highScore != null ? data.highScore : 0;
        const chip = document.createElement('div');
        chip.className = 'aa-score-chip' + (idx === 0 ? ' leader' : '');
        chip.innerHTML = `
            <span class="aa-chip-rank">${idx === 0 ? '👑' : '#' + (idx+1)}</span>
            <img src="${data.pfp || 'TWL O.png'}" onerror="this.src='TWL O.png'">
            <span class="aa-chip-name">${data.name || 'Player'}</span>
            <span class="aa-chip-pts">${livePoints}</span>
            <span class="aa-chip-meta">HS ${highScore}</span>
        `;
        container.appendChild(chip);
    });
}

function _aaUpdateJoinBtn() {
    const btn     = document.getElementById('aa-join-btn');
    const playBtn = document.getElementById('aa-play-btn');
    if (!btn || !_aaEvent) return;

    if (_aaEvent.status === 'live') {
        // Hide the JOIN/LEAVE btn, show the big PLAY NOW btn
        btn.style.display  = 'none';
        if (playBtn) {
            playBtn.style.display = 'inline-block';
            playBtn.textContent   = '▶ PLAY ' + (_aaEvent.game || 'NOW');
            playBtn.onclick       = _aaOpenGame;
        }
    } else {
        if (playBtn) playBtn.style.display = 'none';
        btn.style.display = 'inline-block';
        if (_aaJoined) {
            btn.textContent  = '✓ LEAVE';
            btn.style.opacity = '0.7';
            btn.onclick = _aaLeave;
        } else {
            btn.textContent  = 'JOIN';
            btn.style.opacity = '1';
            btn.onclick = _aaJoin;
        }
    }
}

function _aaJoin() {
    if (!_aaMyUid || !_aaMyProfile) return;
    const r = _aaRef();
    if (!r) return;
    r.child('joined/' + _aaMyUid).set({
        name: _aaMyProfile.displayName || _aaMyProfile.permanentUsername || 'Player',
        pfp:  _aaMyProfile.profilePicURL || 'TWL O.png',
        joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
    _aaFireConfetti();
}

function _aaLeave() {
    if (!_aaMyUid) return;
    const r = _aaRef();
    if (!r) return;
    r.child('joined/' + _aaMyUid).remove();
}

function _aaOpenGame() {
    window.location.href = 'mg.html';
}

function _aaShowAwardChip(award) {
    // Flash a special gold award chip in the ticker for 6 seconds
    const container = document.getElementById('aa-ticker-scores');
    if (!container) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,rgba(255,215,0,0.4),rgba(255,140,0,0.3));border:2px solid #ffd700;border-radius:20px;padding:4px 14px 4px 8px;white-space:nowrap;flex-shrink:0;animation:aaLeaderGlow 0.8s ease-in-out infinite;';
    chip.innerHTML = '<span style="font-size:1.1rem">💎</span><span style="font-weight:900;color:#fff;font-size:0.85rem;">' + (award.name || 'Player') + '</span><span style="color:#ffd700;font-weight:900;font-size:0.9rem;">+' + (award.pts || 0) + '</span>';
    container.prepend(chip);
    setTimeout(() => { if (chip.parentNode) chip.remove(); }, 6000);
}

function _aaHandleAASpecialPopup(popup) {
    if (!popup || !popup.type) return;
    switch (popup.type) {
        case 'safe':
            _aaShowSafePopup(popup);
            break;
        case 'cashPig':
            _aaShowCashPigPopup(popup);
            break;
        case 'flyingCodes':
            _aaShowFlyingCodesPopup(popup);
            break;
        default:
            _aaFireAnnouncement(popup.message || 'A special admin event is happening!');
    }
}

function _aaShowSafePopup(popup) {
    const overlay = document.createElement('div');
    overlay.className = 'aa-special-overlay';
    overlay.innerHTML = `
        <div class="aa-special-card aa-safe-card">
            <button class="aa-popup-close" aria-label="Close popup" style="color:#000!important; background:rgba(255,255,255,0.96)!important;">Close</button>
            <div class="aa-safe-shell">
                <div class="aa-safe-fog"></div>
                <div class="aa-safe-door">
                    <div class="aa-safe-dial"></div>
                </div>
            </div>
            <div class="aa-safe-code" aria-hidden="true">CODE: <strong>${popup.code || 'SECRET'}</strong></div>
        </div>
    `;
    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector('.aa-popup-close');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    const codeEl = overlay.querySelector('.aa-safe-code');
    setTimeout(() => {
        if (codeEl) {
            codeEl.classList.add('aa-code-visible');
            codeEl.setAttribute('aria-hidden', 'false');
        }
    }, 3600);
    setTimeout(() => overlay.classList.add('aa-special-fadeout'), 7000);
    setTimeout(() => overlay.remove(), 7500);
}

function _aaShowCashPigPopup(popup) {
    const overlay = document.createElement('div');
    overlay.className = 'aa-special-overlay';
    overlay.innerHTML = `
        <div class="aa-special-card aa-pig-card">
            <button class="aa-popup-close" aria-label="Close popup" style="color:#000!important; background:rgba(255,255,255,0.96)!important;">Close</button>
            <div class="aa-special-title">GOLDEN PIG!</div>
            <div class="aa-pig-graphic">🐷💰</div>
            <div class="aa-special-code">CODE:<strong>${popup.code || 'PIGGOLD'}</strong></div>
            <div class="aa-special-value">Worth ${popup.value || '??'} points</div>
            <p class="aa-special-message">${popup.message || 'Diamonds and coins are spilling from the golden pig! Grab this promo code now.'}</p>
        </div>
    `;
    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector('.aa-popup-close');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    const count = 12;
    for (let i = 0; i < count; i++) {
        const diamond = document.createElement('div');
        diamond.className = 'aa-diamond';
        diamond.style.left = `${20 + i * 5}%`;
        diamond.style.top = `${60 + Math.random() * 20}%`;
        diamond.style.animation = `aaDiamondFloat ${1.6 + Math.random() * 1.2}s ease-in-out ${i * 0.08}s infinite`;
        overlay.appendChild(diamond);
    }
    setTimeout(() => overlay.classList.add('aa-special-fadeout'), 7000);
    setTimeout(() => overlay.remove(), 7500);
}

function _aaShowFlyingCodesPopup(popup) {
    const overlay = document.createElement('div');
    overlay.className = 'aa-special-overlay';
    overlay.style.background = 'radial-gradient(circle at top center, rgba(255,255,255,0.08), rgba(0,0,0,0.88))';
    document.body.appendChild(overlay);
    const codes = Array.isArray(popup.codes) ? popup.codes.slice(0, 10) : [];
    const count = Math.max(1, Math.min(codes.length, 10));
    for (let i = 0; i < count; i++) {
        const chip = document.createElement('div');
        chip.className = 'aa-wing-code';
        chip.style.top = `${10 + i * 7}%`;
        chip.style.left = `${-25 + i * 10}%`;
        chip.style.animationDelay = `${0.2 * i}s`;
        chip.style.animationDuration = `${7 + Math.random() * 2}s`;
        chip.innerHTML = `<span>${codes[i] || 'CODE'}</span><span class="aa-wing">🪽</span>`;
        overlay.appendChild(chip);
    }
    setTimeout(() => overlay.classList.add('aa-special-fadeout'), 7000);
    setTimeout(() => overlay.remove(), 7500);
}

function _aaFireAnnouncement(text) {
    const el = document.getElementById('aa-announce');
    const textEl = document.getElementById('aa-announce-text');
    if (!el || !textEl) return;
    textEl.textContent = text;
    el.classList.remove('firing');
    void el.offsetWidth;
    el.classList.add('firing');
    _aaFireConfetti(180);
    _aaScreenShake();
    // Extra star bursts around the text
    setTimeout(() => _aaFireConfetti(120), 400);
    setTimeout(() => _aaFireConfetti(80), 900);
    setTimeout(() => el.classList.remove('firing'), 3600);
}

function _aaScreenShake() {
    const body = document.body;
    body.style.transition = 'none';
    let i = 0;
    const frames = [
        'translate(4px,2px)','translate(-4px,-2px)','translate(3px,-3px)',
        'translate(-3px,3px)','translate(2px,4px)','translate(-2px,-4px)',
        'translate(0,0)'
    ];
    const shake = setInterval(() => {
        body.style.transform = frames[i % frames.length];
        i++;
        if (i >= 14) { clearInterval(shake); body.style.transform = ''; }
    }, 40);
}

function _aaFireConfetti(count) {
    const colors = ['#ffd700','#ff4444','#44ff88','#4488ff','#ff44ff','#ffaa00','#00ffff'];
    const n = count || 60;
    for (let i = 0; i < n; i++) {
        const piece = document.createElement('div');
        piece.className = 'aa-confetti-piece';
        piece.style.left = (Math.random() * 100) + 'vw';
        piece.style.top  = '-20px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        piece.style.animationDelay    = (Math.random() * 0.8) + 's';
        piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        piece.style.width  = (6 + Math.random() * 10) + 'px';
        piece.style.height = (6 + Math.random() * 10) + 'px';
        document.body.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
    }
}

// Ensure this function is reachable and valid
window.aaReportScore = function(score) {
    // REMOVE or ADJUST the status check if you want to test while not live
    if (!_aaMyUid || !_aaMyProfile || !_aaEvent || _aaEvent.status !== 'live') {
        console.warn("Score report blocked: Event not live or user not found");
        return;
    }

    const payload = typeof score === 'object'
        ? score
        : { score: score, livePoints: score };

    const r = _aaRef();
    if (!r) return;

    const scoreRef = r.child('scores/' + _aaMyUid);
    scoreRef.once('value').then(snapshot => {
        const existing = snapshot.val() || {};
        const newHighScore = Math.max(existing.highScore || 0, payload.score || 0);
        return scoreRef.set({
            name:       _aaMyProfile.displayName || _aaMyProfile.permanentUsername || 'Player',
            pfp:        _aaMyProfile.profilePicURL || 'TWL O.png',
            score:      payload.score,
            livePoints: payload.livePoints != null ? payload.livePoints : payload.score,
            highScore:  newHighScore,
            updatedAt:  firebase.database.ServerValue.TIMESTAMP
        });
    }).then(() => {
        console.log("Score updated successfully:", payload);
    }).catch(err => {
        console.error("Firebase update failed:", err);
    });
}

window.aaIsLive = function() {
    return _aaEvent && _aaEvent.status === 'live';
};

// Allow game pages to check if they are running during an admin abuse
// by reading Firebase directly (sidebar.js is loaded on the game page too)
window.aaGetEventStatus = function() { return _aaEvent ? _aaEvent.status : null; };

})(); // end IIFE

});