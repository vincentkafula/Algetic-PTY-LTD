

'use client'
import React, { useState } from 'react';


const faq_data = [
  {
    id: "One",
    question: `How quickly can I get set up?`,
    answer: `Most services — a mailbox, a phone number, a domain — are ready within minutes of payment clearing. Website, software, internet, and hardware requests go through our team and take longer, since real work is involved.`,
  },
  {
    id: "Two",
    question: `Can I cancel anytime?`,
    answer: `Yes. There's no long-term contract. Cancel a mailbox or number from your dashboard whenever you like, and you won't be charged for the next cycle.`,
  },
  {
    id: "Three",
    question: `Which countries can I get a phone number in?`,
    answer: `The US, Canada, UK, South Africa, and Zambia today. If you need a country we don't yet support, get in touch and let us know.`,
  },
  {
    id: "Four",
    question: `Do I need technical knowledge to use this?`,
    answer: `No. Everything is managed from one dashboard — creating a mailbox, buying a number, registering a domain — with no server setup or technical configuration required on your side.`,
  },
  {
    id: "Five",
    question: `What happens to my domain when it's about to expire?`,
    answer: `Your dashboard shows the real expiry date pulled directly from the registry, and you can turn on auto-renew from there. We're still building self-service manual renewal — for now, reach out before your renewal date if you need help.`,
  },
]



const FaqArea = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const toggleActive = (index: number) => {
    setActiveIndex(index === activeIndex ? null : index);
  };

  return (
    <>
      <section className="faq_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <span>Faq</span>
            <h2>See all question <br /> & answer</h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-12 col-sm-12 col-xs-12">
              <div className="accordion" id="accordionExample">
                {faq_data.map((item, i) => (
                  <div key={i} className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${activeIndex === i ? 'active' : ''}`}
                        type="button"
                        onClick={() => toggleActive(i)}
                      >
                        {item.question}
                      </button>
                    </h2>
                    <div
                      className={`accordion-collapse collapse ${activeIndex === i ? 'show' : ''}`}
                      aria-labelledby={`heading${item.id}`}
                    >
                      <div className="accordion-body">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FaqArea;
