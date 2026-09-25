import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User, Loader2, Sparkles, TrendingUp, PieChart, DollarSign, HelpCircle } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "What's driving my portfolio performance?" },
  { icon: PieChart, text: "How diversified is my portfolio?" },
  { icon: DollarSign, text: "How can I optimize my dividend income?" },
  { icon: HelpCircle, text: "What are the biggest risks in my portfolio?" },
];

const AIPortfolioChat: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Build portfolio context for the AI
  const buildPortfolioContext = () => {
    const holdings = activePortfolio?.holdings || [];
    const totalValue = Number(activePortfolio?.totalValue) || 0;
    const cashBalance = Number(activePortfolio?.cashBalance) || 0;

    const holdingSummary = holdings.map(h => {
      const value = Number(h.shares) * Number(h.currentPrice);
      const weight = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0';
      const gainLoss = ((Number(h.currentPrice) - Number(h.avgPrice)) / Number(h.avgPrice) * 100).toFixed(1);
      return `${h.symbol}: ${h.shares} shares @ $${Number(h.currentPrice).toFixed(2)}, weight: ${weight}%, gain: ${gainLoss}%, yield: ${Number(h.dividendYield || 0).toFixed(2)}%, sector: ${h.sector || 'Unknown'}`;
    }).join('\n');

    const sectorWeights: Record<string, number> = {};
    holdings.forEach(h => {
      const value = Number(h.shares) * Number(h.currentPrice);
      const sector = h.sector || 'Unknown';
      sectorWeights[sector] = (sectorWeights[sector] || 0) + value;
    });
    const sectorSummary = Object.entries(sectorWeights)
      .map(([s, v]) => `${s}: ${((v / totalValue) * 100).toFixed(1)}%`)
      .join(', ');

    const annualDivIncome = holdings.reduce((sum, h) => {
      return sum + Number(h.shares) * Number(h.currentPrice) * (Number(h.dividendYield || 0) / 100);
    }, 0);

    return `Portfolio: "${activePortfolio?.name}"
Total Value: $${totalValue.toLocaleString()}
Cash: $${cashBalance.toLocaleString()}
Holdings (${holdings.length}):
${holdingSummary}
Sector Allocation: ${sectorSummary}
Annual Dividend Income: $${annualDivIncome.toFixed(0)}
Portfolio Yield: ${totalValue > 0 ? ((annualDivIncome / totalValue) * 100).toFixed(2) : 0}%`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const portfolioContext = buildPortfolioContext();
      const allMessages = [
        ...messages,
        userMsg,
      ].map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('ai-portfolio-chat', {
        body: {
          messages: allMessages,
          portfolioContext,
        },
      });

      if (error) throw error;

      const assistantContent = data?.content || data?.error || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error: ${err.message || 'Unable to connect'}. Please try again.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (q: string) => {
    sendMessage(q);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> AI Portfolio Agent
        </h2>
        <p className="text-muted-foreground">Ask questions about your portfolio and get intelligent insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Area */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0 flex flex-col h-[600px]">
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Your AI Financial Advisor</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      I have full context of your portfolio. Ask me anything about performance, diversification, risk, or strategy.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(q.text)}
                        className="flex items-center gap-2 p-3 text-left rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-sm"
                      >
                        <q.icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">{q.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Analyzing your portfolio...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <form
                onSubmit={e => { e.preventDefault(); sendMessage(input); }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about your portfolio..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={!input.trim() || isLoading} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Context Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Portfolio</span>
              <span className="font-medium">{activePortfolio?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Value</span>
              <span className="font-medium">${Number(activePortfolio?.totalValue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holdings</span>
              <span className="font-medium">{activePortfolio?.holdings?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash</span>
              <span className="font-medium">${Number(activePortfolio?.cashBalance || 0).toLocaleString()}</span>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-muted-foreground leading-relaxed">
                The AI has full access to your holdings, allocations, yields, and sector weights to provide personalized advice.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIPortfolioChat;
