import pytest
import sys

if __name__ =="__main__":
    args=['-vv']
    if len(sys.argv)>1:
        args.extend(sys.argv[1:])
    pytest.main(args=args)


