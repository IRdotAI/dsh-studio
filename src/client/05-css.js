//#region styles
const STUDIO_CSS = `
.st_page{box-sizing:border-box;height:100%;overflow:auto;color:var(--dsw-alias-label-primary);padding:0 clamp(20px,4vw,48px) 72px}
.st_inner{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.st_head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding-top:28px;flex-wrap:wrap}
.st_title{margin:0;font-size:22px;font-weight:600;line-height:30px;display:flex;align-items:center;gap:10px}
.st_titleMark{display:inline-flex;width:30px;height:30px;border-radius:var(--dsw-radius-sm);align-items:center;justify-content:center;color:var(--dsw-alias-label-primary-foreground);background:linear-gradient(135deg,var(--dsw-alias-state-business-primary),var(--studio-accent-2,#c46be0))}
.st_sub{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.st_kbd{font-family:var(--ds-font-family-code);font-size:11px;padding:1px 6px;border-radius:5px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.st_tabs{position:sticky;top:0;z-index:3;display:flex;gap:4px;flex-wrap:wrap;padding:10px 0;background:var(--dsw-alias-bg-base);backdrop-filter:blur(24px) saturate(1.3);border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_tab{border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:6px 12px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.st_tab[aria-selected=true]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font-weight:500}
.st_banner{border-radius:var(--dsw-radius-sm);padding:9px 12px;font-size:13px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent)}
.st_section{display:flex;flex-direction:column;gap:14px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:18px 20px}
.st_sectionHead h3{margin:0;font-size:15px;font-weight:600;line-height:22px}
.st_sectionHead p{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:18px}
.st_row{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end}
.st_field{display:flex;flex-direction:column;gap:6px;min-width:180px;flex:1}
.st_field_narrow{flex:0 0 auto;min-width:0}
.st_label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.st_hint{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:16px}
.st_input{box-sizing:border-box;width:100%;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);padding:7px 10px}
.st_input:focus{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:0}
textarea.st_input{resize:vertical;min-height:96px;line-height:1.5}
.st_mono{font-family:var(--ds-font-family-code);font-size:12px}
.st_btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);padding:6px 12px;cursor:pointer;white-space:nowrap}
.st_btn:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.st_btn[disabled]{opacity:.5;cursor:default}
.st_btn_primary{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}
.st_btn_primary:hover{background:var(--dsw-alias-state-business-primary);filter:brightness(1.08)}
.st_btn_danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent)}
.st_btn_small{padding:3px 8px;font-size:12px}
.st_seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform)}
.st_segBtn{border:0;background:none;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary);padding:5px 11px;border-radius:calc(var(--dsw-radius-sm) - 2px);cursor:pointer}
.st_segBtn[aria-pressed=true]{background:var(--dsw-alias-bg-layer-1) linear-gradient(var(--dsw-alias-interactive-bg-active),var(--dsw-alias-interactive-bg-active));color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12),inset 0 0 0 .5px var(--dsw-alias-border-l4)}
.st_toggle{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13px;line-height:20px}
.st_switch{flex:none;position:relative;width:32px;height:18px;margin-top:1px;border-radius:999px;background:var(--dsw-alias-bg-overlay);transition:background .15s}
.st_switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-switch-thumb,#fff);transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.st_switch[data-on=true]{background:var(--dsw-alias-state-business-primary)}
.st_switch[data-on=true]::after{transform:translateX(14px);background:#fff}
.st_toggleText{display:flex;flex-direction:column}
.st_toggle input:focus-visible+.st_switch{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.st_range{width:100%;accent-color:var(--dsw-alias-state-business-primary)}
.st_rangeHead{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}
.st_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}
.st_card{display:flex;flex-direction:column;gap:0;padding:0;overflow:hidden;font:inherit;text-align:left;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);cursor:pointer;transition:transform .12s,box-shadow .12s}
.st_card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.18)}
.st_card_active{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.st_cardMocks{display:grid;grid-template-columns:1fr 1fr;height:92px}
.st_cardFoot{display:flex;align-items:center;gap:8px;padding:9px 12px}
.st_cardName{font-size:13px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_cardCheck{font-size:12px;color:var(--dsw-alias-state-business-primary);font-weight:600}
.st_mock{display:flex;height:100%;min-width:0}
.st_mockSide{width:24%;display:flex;flex-direction:column;gap:5px;padding:9px 5px}
.st_mockSide i{display:block;height:4px;border-radius:2px}
.st_mockMain{flex:1;display:flex;flex-direction:column;gap:6px;padding:10px 9px;min-width:0}
.st_mockMain i{display:block;border-radius:3px}
.st_mockBubble{align-self:flex-end;width:48%;height:10px;border-radius:5px!important}
.st_mockLine{height:4px}
.st_mockPill{width:30%;height:9px;border-radius:5px!important;margin-top:auto}
.st_editorGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.st_modeCol{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l4)}
.st_modeTitle{font-size:13px;font-weight:600}
.st_color{display:flex;align-items:center;gap:8px}
.st_color input[type=color]{flex:none;width:34px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-xs);background:none;cursor:pointer}
.st_color .st_input{width:96px;font-family:var(--ds-font-family-code);font-size:12px}
.st_color .st_label{flex:1}
.st_badge{font-size:11px;padding:1px 7px;border-radius:999px;font-variant-numeric:tabular-nums;white-space:nowrap}
.st_badge_ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);color:var(--dsw-alias-state-success-primary)}
.st_badge_warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,transparent);color:var(--dsw-alias-state-warn-label,var(--dsw-alias-state-warn-primary))}
.st_bigMock{height:120px;border-radius:var(--dsw-radius-sm);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2)}
.st_pre{margin:0;white-space:pre-wrap;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.55;padding:12px 14px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);max-height:320px;overflow:auto}
.st_promptRow{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_promptRow:last-child{border-bottom:0}
.st_promptBody{flex:1;min-width:0}
.st_promptTitle{font-size:13px;font-weight:500}
.st_promptText{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st_actions{display:flex;gap:6px;flex-wrap:wrap}
.st_identityPreview{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-specific-sidebar-fill);border:.5px solid var(--dsw-alias-border-l2);width:fit-content;min-width:220px}
.st_greetPreview{font-size:22px;font-weight:500;line-height:30px}
.st_brandName{font-size:15px;font-weight:500;line-height:20px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block}
.st_markEmoji{display:inline-flex;align-items:center;justify-content:center;line-height:1}
.st_markMono{display:inline-flex;align-items:center;justify-content:center;border-radius:28%;font-weight:700;letter-spacing:-.02em;color:#fff;background:linear-gradient(135deg,var(--dsw-alias-state-business-primary),var(--studio-accent-2,#c46be0));text-transform:uppercase}
.st_markImg{border-radius:24%;object-fit:cover}
.st_creditHero{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:22px 24px;border-radius:var(--dsw-radius-lg);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),color-mix(in srgb,var(--studio-accent-2,#5ad8e0) 12%,transparent))}
.st_creditMark{display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:28%;color:#fff;background:linear-gradient(135deg,var(--dsw-alias-state-business-primary),var(--studio-accent-2,#5ad8e0));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 6px 18px rgba(0,0,0,.25)}
.st_creditText{flex:1;min-width:200px;display:flex;flex-direction:column;gap:3px}
.st_creditTitle{font-size:22px;font-weight:600;line-height:28px}
.st_creditVersion{font-size:12px;font-weight:500;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);vertical-align:middle}
.st_creditBy{font-size:15px;color:var(--dsw-alias-label-secondary)}
.st_creditBy strong{color:var(--dsw-alias-label-primary);font-weight:600}
.st_creditRow{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_creditRow:last-child{border-bottom:0}
.st_creditName{font-size:13px;font-weight:500;min-width:110px}
.st_creditLine{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.st_link{color:var(--dsw-alias-link,var(--dsw-alias-state-business-primary));text-decoration:none;font-size:13px;white-space:nowrap}
.st_link:hover{text-decoration:underline}
a.st_btn{text-decoration:none}
.st_updateIcon{font-size:24px;line-height:1;flex:none;display:inline-block}
.st_spin{animation:st_spin 1.1s linear infinite}
@keyframes st_spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.st_spin{animation:none}}
.st_relRow{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_relRow:last-child{border-bottom:0}
.st_relHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.st_relVersion{font-family:var(--ds-font-family-code);font-size:13px;font-weight:600;min-width:64px}
.st_relConfirm{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--dsw-radius-sm);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
.st_badge_accent{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent);color:var(--dsw-alias-state-business-primary)}
.st_navIcon{position:relative;display:inline-flex}
.st_navDot{position:absolute;top:-3px;right:-4px;width:7px;height:7px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1.5px var(--dsw-specific-sidebar-fill)}
.st_markThumb{position:relative;width:56px;height:56px;flex:none}
.st_markThumb img{width:56px;height:56px;border-radius:24%;object-fit:cover;border:.5px solid var(--dsw-alias-border-l4);display:block}
.st_markRemove{position:absolute;top:-8px;right:-8px;width:22px;height:22px;padding:0;border-radius:50%;corner-shape:round;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:15px;line-height:1;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer}
.st_markRemove:hover,.st_markRemove:focus-visible{background:var(--dsw-alias-state-error-primary);color:#fff;border-color:transparent}
.st_wallThumb{width:160px;height:90px;border-radius:var(--dsw-radius-sm);background-size:cover;background-position:center;border:.5px solid var(--dsw-alias-border-l4)}
.st_backdrop{position:fixed;inset:0;z-index:2147483100;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.2));display:flex;justify-content:center;align-items:flex-start;padding-top:12vh}
.st_palette{width:min(640px,92vw);max-height:min(560px,72vh);display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
.st_paletteInput{border:0;outline:0;background:none;font:inherit;font-size:15px;color:inherit;padding:16px 18px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_paletteList{overflow:auto;padding:6px}
.st_paletteGroup{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:10px 12px 4px}
.st_paletteItem{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;font:inherit;font-size:13.5px;color:inherit;text-align:left;padding:8px 12px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_paletteItem[data-active=true]{background:var(--dsw-alias-interactive-bg-active)}
.st_paletteIcon{width:20px;text-align:center;flex:none}
.st_paletteLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_paletteHint{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.st_paletteFoot{display:flex;gap:14px;padding:8px 14px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.st_paletteEmpty{padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.st_toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483200;background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);padding:8px 16px;border-radius:999px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none;animation:st_toast_in .18s ease-out}
@keyframes st_toast_in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
.st_cbWrap{position:relative;display:inline-flex}
.st_cbBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.st_cbBtn:hover,.st_cbBtn[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}
.st_cbMenu{position:absolute;left:0;bottom:calc(100% + 8px);z-index:60;width:min(340px,80vw);max-height:320px;overflow:auto;padding:6px;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);box-shadow:0 12px 36px rgba(0,0,0,.28)}
.st_cbHead{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:6px 10px 4px}
.st_cbFolder{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);padding:8px 10px 2px}
.st_cbItem{display:flex;flex-direction:column;gap:1px;width:100%;border:0;background:none;font:inherit;text-align:left;color:var(--dsw-alias-label-primary);padding:7px 10px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_cbItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.st_cbItemTitle{font-size:13px}
.st_cbItemText{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st_cbManage{width:100%;border:0;border-top:.5px solid var(--dsw-alias-border-l2);background:none;font:inherit;font-size:12px;color:var(--dsw-alias-state-business-primary);text-align:left;padding:8px 10px 4px;margin-top:4px;cursor:pointer}
.st_section,.st_palette,.st_cbMenu,.st_card{-webkit-backdrop-filter:var(--studio-glass-filter,none);backdrop-filter:var(--studio-glass-filter,none);background-image:var(--studio-glass-sheen,none)}
.st_look{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px;border-radius:var(--dsw-radius-lg);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),color-mix(in srgb,var(--studio-accent-2,#5ad8e0) 12%,transparent))}
.st_lookText{flex:1;min-width:220px}
.st_lookTitle{font-size:15px;font-weight:600;line-height:22px}
.st_lookDesc{font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:18px}

.st_headRight{display:flex;align-items:center;gap:8px}
.st_langSelect{width:auto;min-width:150px;padding:5px 8px;font-size:12.5px}
.st_stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(136px,1fr));gap:10px}
.st_stat{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4)}
.st_statLabel{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.st_statValue{font-size:21px;font-weight:600;line-height:28px;font-variant-numeric:tabular-nums}
.st_statNote{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.st_chart{width:100%;height:150px;display:block}
.st_tableWrap{overflow:auto;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2)}
.st_table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
.st_table th{text-align:start;font-weight:500;color:var(--dsw-alias-label-tertiary);padding:7px 10px;border-bottom:.5px solid var(--dsw-alias-border-l2);white-space:nowrap}
.st_table td{padding:6px 10px;border-bottom:.5px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);white-space:nowrap}
.st_table tr:last-child td{border-bottom:0}
.st_num{text-align:end}
.st_priceInput{width:74px;padding:4px 6px;font-size:12px}
.st_schedRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.st_schedRow input[type=time]{width:auto}
.st_schedRow select{width:auto;min-width:200px}
.st_looks{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.st_lookCard{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4)}
.st_lookCardName{flex:1;min-width:0;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_swatch{display:inline-block;width:18px;height:18px;border-radius:50%;corner-shape:round;border:.5px solid var(--dsw-alias-border-l4);vertical-align:middle}
.st_dialog{width:min(480px,92vw);display:flex;flex-direction:column;gap:12px;padding:18px 20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);box-shadow:0 24px 70px rgba(0,0,0,.35)}
.st_dialogTitle{font-size:15px;font-weight:600}
.st_folderHead{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:12px 0 2px}
.st_cardAuthor{font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-tertiary);padding:0 12px 10px;margin-top:-4px}
.st_galleryCard>.st_card{flex:1}
.st_galleryCard{display:flex;flex-direction:column}
.st_galleryActions{display:flex;gap:6px;padding:0 12px 12px}
.st_section,.st_palette,.st_cbMenu,.st_card,.st_dialog,.st_stat{-webkit-backdrop-filter:var(--studio-glass-filter,none);backdrop-filter:var(--studio-glass-filter,none)}
.st_bannerInfo{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent)}
.st_schedLocation{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4)}
.st_schedLocation .st_input{width:170px}
.st_wsRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 0;border-bottom:.5px solid var(--dsw-alias-border-l4)}
.st_wsRow:last-child{border-bottom:0}
.st_wsRow select{width:auto;min-width:220px;margin-left:auto}
.st_wsName{font-size:13px;font-weight:500;min-width:0;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_lookCard_active{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary) inset}
.st_packs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.st_packCard{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4)}
.st_packHead{display:flex;align-items:center;gap:10px}
.st_packEmoji{font-size:22px;line-height:1}
.st_packName{font-size:14px;font-weight:600}
.st_packList{margin:0;padding-inline-start:18px;font-size:12.5px;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:2px}
.st_exportChoices{display:flex;flex-direction:column;gap:8px}
.st_exportChoice{display:flex;align-items:center;gap:12px;padding:10px 12px;text-align:start;font:inherit;color:inherit;cursor:pointer;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l4)}
.st_exportChoice:hover,.st_exportChoice:focus-visible{border-color:var(--dsw-alias-state-business-primary)}
.st_exportChoice>span:last-child{display:flex;flex-direction:column;gap:2px}
.st_exportIcon{font-size:22px;line-height:1}
.st_moneyInput{display:flex;align-items:center;gap:6px}
.st_moneyInput .st_input{width:120px}
.st_meterRow{display:flex;flex-direction:column;gap:5px}
.st_meterHead{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:500}
.st_meter{height:8px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));overflow:hidden;border:.5px solid var(--dsw-alias-border-l4)}
.st_meter>span{display:block;height:100%;border-radius:inherit;background:var(--dsw-alias-state-success-primary);transition:width .4s ease}
.st_meter_warn>span{background:var(--dsw-alias-state-warn-primary)}
.st_meter_over>span{background:var(--dsw-alias-state-error-primary)}
`;
//#endregion
