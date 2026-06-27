import { Test, TestingModule } from '@nestjs/testing';
import { JobPortalController } from './jobPortal.controller';
import { JobPortalService } from './jobPortal.service';

describe('JobPortalController', () => {
  let controller: JobPortalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobPortalController],
      providers: [JobPortalService],
    }).compile();

    controller = module.get<JobPortalController>(JobPortalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
