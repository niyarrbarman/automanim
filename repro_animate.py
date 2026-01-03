from manim import *

class GeneratedScene(Scene):
    def construct(self):
        c = Circle()
        self.play(Create(c))
        # This should work: calling the method
        self.play(c.animate.scale(2))
