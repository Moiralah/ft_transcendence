import React from 'react';
import { componentTokens } from './colorPalete';
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
            Code: <span style={{color : token.textRole}}>{code}</span>
          </Typography>
          
          <Typography
            as='p'
            variant='caption'
          >
            Role: <span style={{color : token.textRole}}>{userRole}</span>
          </Typography>

          <Typography
            as='p'
            variant='caption'
          >
            <p>{profiles?.length || 0} profiles</p>
          </Typography>

        </div>
        <div>
          <Typography
            as='p'
            variant='caption'
          >
            <p>Owner: {owner?.username || 'Unknown'}</p>
          </Typography>
          
        </div>
      </div>
    );
};
