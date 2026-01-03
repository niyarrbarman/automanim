from manim import *

class GeneratedScene(Scene):
    def construct(self):
        expr = Tex("1+1")
        result = Tex("2")
        self.play(Write(expr))
        self.wait(1)
        self.play(ReplacementTransform(expr, result))
        self.wait(1)
        fib = MathTex(r"F_n = F_{n-1} + F_{n-2}")
        fib.next_to(result, DOWN, buff=0.5)
        self.play(Write(fib))
        self.wait(1)
        bayes = MathTex(r"P(A|B) = \frac{P(B|A) P(A)}{P(B)}")
        bayes.next_to(fib, DOWN, buff=0.5)
        self.play(Write(bayes))
        self.wait(1)
