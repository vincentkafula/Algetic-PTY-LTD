
'use client'

import VideoPopup from '@/modals/VideoPopup';
import Link from 'next/link'; 

const HeroAreaHomeOne = () => { 

  return (
    <>
      <section className="home_bg hb_height"
        style={{ backgroundImage: `url(/assets/img/bg/home-bg.jpg)`, backgroundSize: "cover", backgroundPosition: "center center" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-7 col-sm-12 col-xs-12">
              <div className="hero-text ht_top">
                <h1>We're a best cyber security problem solution team</h1>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, consectetur adipiscing elit tempor ut labore</p>
              </div>
              <div className="home_btns" style={{display: 'flex'}}>
                <Link href="/about" className="btn_one">Discover More</Link>
                <VideoPopup>
                <a className="video-play"  
                href="https://www.youtube.com/watch?v=zE_WFiHnSlY" 
                ><i className="ti-image"></i> <span className="video-title">Video Tour</span></a>
                </VideoPopup>
              </div>
            </div>
          </div>
        </div>
      </section>

    
    </>
  );
};

export default HeroAreaHomeOne;