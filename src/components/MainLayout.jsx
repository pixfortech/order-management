import React, { useState } from 'react';
import OrderForm from './OrderForm';
import OrderTabs from './OrderTabs';
import OrderSummary from './OrderSummary';
import SettingsPanel from './SettingsPanel';
import styled from 'styled-components';
import { useSwipeable } from 'react-swipeable';
import { ClipboardList, FileText, LayoutDashboard, Settings } from 'lucide-react';
import AnimatedTabs from './AnimatedTabs';

const tabOrder = ['order', 'orders', 'summary', 'settings'];
const tabIcons = {
  order: <ClipboardList size={18} />,
  orders: <FileText size={18} />,
  summary: <LayoutDashboard size={18} />,
  settings: <Settings size={18} />,
};

const MainLayout = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState('order');

  const handleSwipe = (direction) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (direction === 'LEFT' && currentIndex < tabOrder.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direction === 'RIGHT' && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
      setActiveTab(tabOrder[nextIndex]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('LEFT'),
    onSwipedRight: () => handleSwipe('RIGHT'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'order':
        return <OrderForm />;
      case 'orders':
        return <OrderTabs />;
      case 'summary':
        return <OrderSummary />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <Container {...swipeHandlers}>
      <TabsWrap>
        {tabOrder.map((tab, idx) => (
          <React.Fragment key={tab}>
            <input
              hidden
              className={`rd-${idx}`}
              name="tab"
              id={`tab-${tab}`}
              type="radio"
              checked={activeTab === tab}
              onChange={() => setActiveTab(tab)}
            />
            <label className="label" htmlFor={`tab-${tab}`}>
              <span>
                {tabIcons[tab]} &nbsp;
                {tab === 'order' ? 'Current Order' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            </label>
          </React.Fragment>
        ))}
        <div className="bar" style={{ transform: `translateX(${tabOrder.indexOf(activeTab) * 100}%)` }} />
        <div className="slidebar" style={{ transform: `translateX(${tabOrder.indexOf(activeTab) * 100}%)` }} />
      </TabsWrap>
      <TabContent>{renderTabContent()}</TabContent>
    </Container>
  );
  
  return (
    <div>
      <AnimatedTabs isAdmin={isAdmin} />
    </div>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  align-items: center;
`;

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  width: 100%;
`;

const TabsWrap = styled.div`
  --round: 10px;
  --p-x: 8px;
  --p-y: 4px;
  --w-label: 180px; /* increased width */
  --theme: #49488D;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  padding: var(--p-y) var(--p-x);
  background: #f9f9f9;
  border-radius: var(--round);
  width: 100%;
  max-width: 800px; /* control how wide it appears */
  margin: 0 auto 12px auto;

  input {
    display: none;
  }

  .label {
    cursor: pointer;
    font-size: 1rem; /* consistent font size */
    font-weight: 600;
    color: #333;
    padding: 14px 20px;
    width: var(--w-label);
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-bottom: 3px solid transparent;
    transition: all 0.3s ease-in-out;
  }

  .label:hover::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: #6c6baf33; /* light hover overlay */
    border-radius: var(--round);
    z-index: -1;
  }

  input:checked + .label {
    color: var(--theme);
    border-top: 3px solid var(--theme);
    border-bottom: 3px solid var(--theme);
    font-weight: bold;
  }

  .bar,
  .slidebar {
    display: none; /* hide default bars */
  }
`;


export default MainLayout;
