import {Composition} from 'remotion';
import {Promo, DURATION} from './Promo';
import {Promo2, DURATION2} from './Promo2';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AuditKitPromo"
        component={Promo}
        durationInFrames={DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="AuditKitPromo2"
        component={Promo2}
        durationInFrames={DURATION2}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
