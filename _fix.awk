BEGIN{skip=0}
/musicDrift\{/ {
  print "@keyframes musicDrift{";
  print "  0%{ transform: translate3d(0,0,0) rotate(0deg); }";
  print "  50%{ transform: translate3d(-18px, 12px, 0) rotate(0.4deg); }";
  print "  100%{ transform: translate3d(0,0,0) rotate(0deg); }";
  print "}";
  skip=1;
  next;
}
skip==1 {
  if($0 ~ /^[ \t]*}[ \t]*$/){ skip=0 }
  next;
}
{print}
