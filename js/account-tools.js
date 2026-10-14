(() => {
  'use strict';
  let serial = 0;
  // Shared keyboard-accessible sections. Moving existing nodes preserves form values
  // and event handlers; hidden panels remain part of their forms when saved.
  function tabs(container, sections, selected, onSelect) {
    const nav = document.createElement('div');
    nav.className = 'tool-tabs'; nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Workspace sections');
    const panes = [];
    sections.forEach(({ key, label, nodes }) => {
      const id = `tool-pane-${++serial}`, pane = document.createElement('section');
      pane.id = id; pane.className = 'tool-pane'; pane.dataset.toolPane = key;
      pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', `${id}-tab`);
      pane.tabIndex = 0;
      for (const node of nodes.filter(Boolean)) pane.append(node);
      const button = document.createElement('button'); button.type = 'button';
      button.id = `${id}-tab`; button.textContent = label; button.dataset.toolTab = key;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', id);
      nav.append(button); panes.push({ key, pane, button });
    });
    const choose = (key, focus = false) => {
      panes.forEach((entry) => {
        const active = entry.key === key;
        entry.pane.hidden = !active; entry.button.tabIndex = active ? 0 : -1;
        entry.button.setAttribute('aria-selected', String(active));
        if (active && focus) entry.button.focus();
      });
      onSelect?.(key);
    };
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tool-tab]');
      if (button) choose(button.dataset.toolTab);
    });
    nav.addEventListener('keydown', (event) => {
      const index = panes.findIndex((entry) => entry.button === event.target);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      choose(panes[event.key === 'Home' ? 0 : event.key === 'End' ? panes.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + panes.length) % panes.length].key, true);
    });
    container.append(nav, ...panes.map((entry) => entry.pane));
    choose(panes.some((entry) => entry.key === selected) ? selected : panes[0].key);
  }
  function editor(form, selected = 'basics', onSelect) {
    const children = [...form.children], groups = [];
    let current = { key:'basics', label:'Basics', nodes:[] }; groups.push(current);
    for (const child of children) {
      if (child.matches('.diving-actions,[data-editor-status]')) continue;
      if (child.tagName === 'FIELDSET') {
        current = { key:`section-${groups.length}`, label:child.querySelector('legend')?.textContent || 'Details', nodes:[child] };
        groups.push(current);
      } else current.nodes.push(child);
    }
    const body = document.createElement('div'); body.className = 'tool-editor-body wide';
    const footer = form.querySelector('.diving-actions'); form.insertBefore(body, form.firstChild);
    tabs(body, groups, selected, onSelect);
    // Native validation cannot focus a required field inside a hidden panel.
    form.addEventListener('invalid', (event) => {
      const pane = event.target.closest('[data-tool-pane]');
      if (pane?.hidden) body.querySelector(`[data-tool-tab="${pane.dataset.toolPane}"]`)?.click();
    }, true);
    footer?.classList.add('tool-editor-footer');
  }
  function tidyActions(container) {
    const actions=container.querySelector(':scope > .diving-actions');if(!actions)return;
    const secondary=[...actions.querySelectorAll('[data-delete],[data-plan-delete]')];if(!secondary.length)return;
    const menu=document.createElement('details');menu.className='tool-record-menu';
    const summary=document.createElement('summary');summary.textContent='More';summary.setAttribute('aria-label','More record actions');
    const content=document.createElement('div');content.append(...secondary);menu.append(summary,content);actions.append(menu);
  }
  function browser(panel) {
    const layout=panel.querySelector('.diving-layout'),list=layout?.querySelector('[data-list],[data-plan-list]');if(!list)return;
    const aside=document.createElement('aside');aside.className='diving-browser';
    const header=document.createElement('header');header.className='browser-heading';
    const original=panel.querySelector('.diving-header'),title=original?.querySelector('h2'),add=original?.querySelector('[data-add],[data-plan-new]');
    const more=document.createElement('details');more.className='browser-more';more.innerHTML='<summary aria-label="Browser actions">⋯</summary><div></div>';
    if(title){if(panel.hasAttribute('data-diving-logbook'))title.textContent='Dive library';header.append(title);}
    if(add){add.title=add.textContent;add.setAttribute('aria-label',add.textContent);add.textContent='+';add.classList.remove('primary');add.classList.add('browser-add');header.append(add);}
    header.append(more);original?.remove();aside.append(header);
    const switcher=panel.querySelector('.tool-view-switch,.diving-setups');if(switcher)aside.append(switcher);
    const toolbar=panel.querySelector('.diving-toolbar'),search=toolbar?.querySelector('input[type="search"]');
    const searchRow=document.createElement('div');searchRow.className='browser-search';if(search){search.placeholder=panel.hasAttribute('data-diving-logbook')?'Find a dive…':panel.hasAttribute('data-diving-gear')?'Find equipment…':'Find a trip…';searchRow.append(search);}
    const filters=document.createElement('details');filters.className='browser-filters';filters.innerHTML='<summary aria-label="Search filters and sorting">Filters</summary><div></div>';
    toolbar?.querySelectorAll('select').forEach((select)=>{const label=document.createElement('label');label.textContent=select.getAttribute('aria-label')||'Filter';label.append(select);filters.lastElementChild.append(label);});
    const dates=panel.querySelector('.tool-filters');if(dates){filters.lastElementChild.append(...dates.querySelector('div').children);dates.remove();}
    searchRow.append(filters);aside.append(searchRow);
    toolbar?.querySelectorAll('button').forEach((button)=>more.lastElementChild.append(button));toolbar?.remove();
    list.before(aside);aside.append(list);
    const pagination=document.createElement('div');pagination.dataset.browserPagination='';aside.append(pagination);
    const status=panel.querySelector('[data-sync-status],[data-planner-status]');if(status)aside.append(status);
  }
  function recordHeader(container){
    const header=document.createElement('header');header.className='record-workspace-header';
    const back=container.querySelector(':scope > .diving-mobile-back');if(back){back.textContent='‹';header.append(back);}
    const title=document.createElement('div');title.className='record-workspace-title';
    const h3=container.querySelector(':scope > h3'),meta=container.querySelector(':scope > p');if(h3)title.append(h3);if(meta)title.append(meta);header.append(title);
    const actions=container.querySelector(':scope > .diving-actions');if(actions)header.append(actions);container.prepend(header);
  }
  document.addEventListener('click',(event)=>{
    document.querySelectorAll('.account-more[open],.tool-record-menu[open],.tool-export[open],.browser-filters[open],.browser-more[open]').forEach((menu)=>{if(!menu.contains(event.target))menu.open=false;});
  });
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape')document.querySelectorAll('.account-more[open],.tool-record-menu[open],.tool-export[open],.browser-filters[open],.browser-more[open]').forEach((menu)=>{menu.open=false;menu.querySelector('summary').focus();});});
  window.DMZTools = { tabs, editor, tidyActions, browser, recordHeader };
})();
