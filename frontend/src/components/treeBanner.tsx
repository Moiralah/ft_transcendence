import React from 'react';
import { componentTokens } from './colorPalette';
import { Typography } from './typograph';

interface TreeBannerProp {
    name: String;
    code: String;
    userRole: 'ADMIN' | 'MEMBER' | 'VIEWER' | 'MODERATOR';
    profiles: Array<any>;
    owner: any;
    themeMode?: 'light';
}

export function TreeBanner({name, code, userRole, profiles, owner, themeMode}: TreeBannerProp ) {

    const token = componentTokens.TreeBanner(themeMode);

    return (
      <div className="flex justify-between items-center">
        <div>
          <Typography
            as='h3' 
            variant='h3'
          >
            { name }
          </Typography>

          <Typography
            as='p'
            variant='caption'
          >
            Code: <b style={{color : token.textRole}}>{code}</b>
          </Typography>
          
          <Typography
            as='p'
            variant='caption'
          >
            Role: <b style={{color : token.textRole}}>{userRole}</b>
          </Typography>

          <Typography
            as='p'
            variant='caption'
          >
            <b>{profiles?.length || 0} profiles</b>
          </Typography>

        </div>
        <div>
          <Typography
            as='p'
            variant='caption'
          >
            <b>Owner: {owner?.username || 'Unknown'}</b>
          </Typography>
          
        </div>
      </div>
    );
};
